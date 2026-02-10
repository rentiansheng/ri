// Package riclient provides an RI client for connecting to the Gateway.
package riclient

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"

	"om/gateway/internal/types"
)

// EventHandler is called when an event is received from the Gateway.
type EventHandler func(ctx context.Context, env *types.Envelope) (*types.ResponsePayload, error)

// ClientState represents the current state of the RI client.
type ClientState string

const (
	StateInit         ClientState = "INIT"
	StateRegistering  ClientState = "REGISTERING"
	StateConnected    ClientState = "CONNECTED"
	StateDegraded     ClientState = "DEGRADED"
	StateReconnecting ClientState = "RECONNECTING"
	StateDisconnected ClientState = "DISCONNECTED"
)

// Config holds the configuration for the RI client.
type Config struct {
	GatewayURL     string
	RIID           string
	Version        string
	Capabilities   []string
	MaxConcurrency int
	Labels         map[string]string

	PollTimeout       time.Duration
	HeartbeatInterval time.Duration
	ReconnectInterval time.Duration
	MaxReconnectDelay time.Duration
}

// DefaultConfig returns a Config with sensible defaults.
func DefaultConfig() Config {
	return Config{
		GatewayURL:        "http://localhost:8080",
		Version:           "1.0.0",
		Capabilities:      []string{"chat", "command"},
		MaxConcurrency:    10,
		PollTimeout:       30 * time.Second,
		HeartbeatInterval: 10 * time.Second,
		ReconnectInterval: 1 * time.Second,
		MaxReconnectDelay: 30 * time.Second,
	}
}

// Client is an RI client that connects to the Gateway using HTTP Long Polling.
type Client struct {
	config     Config
	httpClient *http.Client
	handler    EventHandler

	state   ClientState
	stateMu sync.RWMutex

	inflight   int
	inflightMu sync.Mutex

	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup

	// Callbacks
	OnStateChange func(old, new ClientState)
	OnError       func(err error)
}

// New creates a new RI client with the given configuration.
func New(cfg Config) *Client {
	if cfg.PollTimeout == 0 {
		cfg.PollTimeout = 30 * time.Second
	}
	if cfg.HeartbeatInterval == 0 {
		cfg.HeartbeatInterval = 10 * time.Second
	}
	if cfg.ReconnectInterval == 0 {
		cfg.ReconnectInterval = 1 * time.Second
	}
	if cfg.MaxReconnectDelay == 0 {
		cfg.MaxReconnectDelay = 30 * time.Second
	}

	return &Client{
		config: cfg,
		httpClient: &http.Client{
			Timeout: cfg.PollTimeout + 5*time.Second,
		},
		state: StateInit,
	}
}

// SetHandler sets the event handler for processing incoming events.
func (c *Client) SetHandler(handler EventHandler) {
	c.handler = handler
}

// State returns the current client state.
func (c *Client) State() ClientState {
	c.stateMu.RLock()
	defer c.stateMu.RUnlock()
	return c.state
}

func (c *Client) setState(newState ClientState) {
	c.stateMu.Lock()
	oldState := c.state
	c.state = newState
	c.stateMu.Unlock()

	if c.OnStateChange != nil && oldState != newState {
		c.OnStateChange(oldState, newState)
	}
}

// Start begins the client's connection to the Gateway.
func (c *Client) Start(ctx context.Context) error {
	c.ctx, c.cancel = context.WithCancel(ctx)

	if err := c.register(); err != nil {
		return fmt.Errorf("registration failed: %w", err)
	}

	c.wg.Add(2)
	go c.pollLoop()
	go c.heartbeatLoop()

	return nil
}

// Stop gracefully stops the client.
func (c *Client) Stop() {
	if c.cancel != nil {
		c.cancel()
	}
	c.wg.Wait()
	c.setState(StateDisconnected)
}

func (c *Client) register() error {
	c.setState(StateRegistering)

	reg := types.RIRegistration{
		RIID:           c.config.RIID,
		Version:        c.config.Version,
		Capabilities:   c.config.Capabilities,
		MaxConcurrency: c.config.MaxConcurrency,
		Labels:         c.config.Labels,
	}

	body, err := json.Marshal(reg)
	if err != nil {
		return err
	}

	resp, err := c.httpClient.Post(
		c.config.GatewayURL+"/ri/register",
		"application/json",
		bytes.NewReader(body),
	)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		data, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("registration failed: %s - %s", resp.Status, string(data))
	}

	c.setState(StateConnected)
	return nil
}

func (c *Client) pollLoop() {
	defer c.wg.Done()

	reconnectDelay := c.config.ReconnectInterval

	for {
		select {
		case <-c.ctx.Done():
			return
		default:
		}

		events, err := c.poll()
		if err != nil {
			c.handlePollError(err, &reconnectDelay)
			continue
		}

		// Reset reconnect delay on successful poll
		reconnectDelay = c.config.ReconnectInterval
		if c.State() != StateConnected {
			c.setState(StateConnected)
		}

		for _, env := range events {
			c.handleEvent(env)
		}
	}
}

func (c *Client) poll() ([]*types.Envelope, error) {
	req, err := http.NewRequestWithContext(c.ctx, "GET", c.config.GatewayURL+"/ri/poll", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("X-RI-ID", c.config.RIID)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		// RI not registered, need to re-register
		return nil, fmt.Errorf("RI not registered")
	}

	if resp.StatusCode != http.StatusOK {
		data, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("poll failed: %s - %s", resp.Status, string(data))
	}

	var result struct {
		Events []*types.Envelope `json:"events"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return result.Events, nil
}

func (c *Client) handlePollError(err error, reconnectDelay *time.Duration) {
	if c.OnError != nil {
		c.OnError(err)
	}

	// Check if we need to re-register
	if err.Error() == "RI not registered" {
		c.setState(StateReconnecting)
		if regErr := c.register(); regErr != nil {
			if c.OnError != nil {
				c.OnError(fmt.Errorf("re-registration failed: %w", regErr))
			}
		}
		return
	}

	c.setState(StateDegraded)

	select {
	case <-c.ctx.Done():
		return
	case <-time.After(*reconnectDelay):
	}

	// Exponential backoff
	*reconnectDelay *= 2
	if *reconnectDelay > c.config.MaxReconnectDelay {
		*reconnectDelay = c.config.MaxReconnectDelay
	}
}

func (c *Client) handleEvent(env *types.Envelope) {
	if c.handler == nil {
		return
	}

	c.inflightMu.Lock()
	c.inflight++
	c.inflightMu.Unlock()

	go func() {
		defer func() {
			c.inflightMu.Lock()
			c.inflight--
			c.inflightMu.Unlock()
		}()

		ctx, cancel := context.WithTimeout(c.ctx, 25*time.Second)
		defer cancel()

		resp, err := c.handler(ctx, env)
		if err != nil {
			if c.OnError != nil {
				c.OnError(fmt.Errorf("handler error for event %s: %w", env.ID, err))
			}
			return
		}

		if resp != nil {
			if err := c.sendResponse(env.ID, resp); err != nil {
				if c.OnError != nil {
					c.OnError(fmt.Errorf("failed to send response for event %s: %w", env.ID, err))
				}
			}
		}
	}()
}

func (c *Client) sendResponse(eventID string, resp *types.ResponsePayload) error {
	env, err := types.NewEnvelope(types.MessageTypeResponse, eventID, resp)
	if err != nil {
		return err
	}

	body, err := json.Marshal(env)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(c.ctx, "POST", c.config.GatewayURL+"/ri/response", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-RI-ID", c.config.RIID)

	httpResp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer httpResp.Body.Close()

	if httpResp.StatusCode != http.StatusOK {
		data, _ := io.ReadAll(httpResp.Body)
		return fmt.Errorf("send response failed: %s - %s", httpResp.Status, string(data))
	}

	return nil
}

func (c *Client) heartbeatLoop() {
	defer c.wg.Done()

	ticker := time.NewTicker(c.config.HeartbeatInterval)
	defer ticker.Stop()

	for {
		select {
		case <-c.ctx.Done():
			return
		case <-ticker.C:
			if err := c.sendHeartbeat(); err != nil {
				if c.OnError != nil {
					c.OnError(fmt.Errorf("heartbeat failed: %w", err))
				}
			}
		}
	}
}

func (c *Client) sendHeartbeat() error {
	c.inflightMu.Lock()
	inflight := c.inflight
	c.inflightMu.Unlock()

	status := "ok"
	if c.State() == StateDegraded {
		status = "degraded"
	}

	hb := types.HeartbeatPayload{
		Status:   status,
		Load:     float64(inflight) / float64(c.config.MaxConcurrency),
		Inflight: inflight,
	}

	body, err := json.Marshal(hb)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(c.ctx, "POST", c.config.GatewayURL+"/ri/heartbeat", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-RI-ID", c.config.RIID)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		data, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("heartbeat failed: %s - %s", resp.Status, string(data))
	}

	return nil
}

// Inflight returns the current number of in-flight event handlers.
func (c *Client) Inflight() int {
	c.inflightMu.Lock()
	defer c.inflightMu.Unlock()
	return c.inflight
}
