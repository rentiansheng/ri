package eventbus

import (
	"context"
	"fmt"
	"sync"
	"time"

	"om/gateway/internal/connection"
	"om/gateway/internal/registry"
	"om/gateway/internal/types"

	"github.com/google/uuid"
)

const (
	DefaultResponseTimeout = 30 * time.Second
)

type Event struct {
	ID        string
	Platform  types.Platform
	EventType string
	Data      map[string]interface{}
	Metadata  map[string]string
}

type EventBus struct {
	registry *registry.Registry
	connMgr  *connection.ConnectionManager

	inflightReqs map[string]*InflightRequest
	inflightMu   sync.RWMutex

	responseTimeout time.Duration
}

type InflightRequest struct {
	EventID    string
	RIID       string
	Event      *Event
	CreatedAt  time.Time
	ResponseCh chan *types.ResponsePayload
}

func New(reg *registry.Registry, connMgr *connection.ConnectionManager) *EventBus {
	return &EventBus{
		registry:        reg,
		connMgr:         connMgr,
		inflightReqs:    make(map[string]*InflightRequest),
		responseTimeout: DefaultResponseTimeout,
	}
}

func (eb *EventBus) Publish(ctx context.Context, event *Event) (*types.ResponsePayload, error) {
	capability := fmt.Sprintf("%s.%s", event.Platform, event.EventType)

	ri := eb.registry.SelectRI(capability)
	if ri == nil {
		return nil, fmt.Errorf("no available RI for capability: %s", capability)
	}

	conn := eb.connMgr.Get(ri.ID)
	if conn == nil {
		return nil, fmt.Errorf("RI connection not found: %s", ri.ID)
	}

	eventID := uuid.New().String()
	if event.ID != "" {
		eventID = event.ID
	}

	payload := &types.EventPayload{
		SessionID: eventID,
		Platform:  event.Platform,
		EventType: event.EventType,
		Data:      event.Data,
	}

	env, err := types.NewEnvelope(types.MessageTypeEvent, eventID, payload)
	if err != nil {
		return nil, fmt.Errorf("failed to create envelope: %w", err)
	}

	inflight := &InflightRequest{
		EventID:    eventID,
		RIID:       ri.ID,
		Event:      event,
		CreatedAt:  time.Now(),
		ResponseCh: make(chan *types.ResponsePayload, 1),
	}

	eb.inflightMu.Lock()
	eb.inflightReqs[eventID] = inflight
	eb.inflightMu.Unlock()

	defer func() {
		eb.inflightMu.Lock()
		delete(eb.inflightReqs, eventID)
		eb.inflightMu.Unlock()
	}()

	if !conn.EnqueueEvent(env) {
		return nil, fmt.Errorf("failed to enqueue event: queue full")
	}

	select {
	case resp := <-inflight.ResponseCh:
		return resp, nil
	case <-time.After(eb.responseTimeout):
		return nil, fmt.Errorf("timeout waiting for response from RI: %s", ri.ID)
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

func (eb *EventBus) PublishAsync(event *Event) (string, error) {
	capability := fmt.Sprintf("%s.%s", event.Platform, event.EventType)

	ri := eb.registry.SelectRI(capability)
	if ri == nil {
		return "", fmt.Errorf("no available RI for capability: %s", capability)
	}

	conn := eb.connMgr.Get(ri.ID)
	if conn == nil {
		return "", fmt.Errorf("RI connection not found: %s", ri.ID)
	}

	eventID := uuid.New().String()
	if event.ID != "" {
		eventID = event.ID
	}

	payload := &types.EventPayload{
		SessionID: eventID,
		Platform:  event.Platform,
		EventType: event.EventType,
		Data:      event.Data,
	}

	env, err := types.NewEnvelope(types.MessageTypeEvent, eventID, payload)
	if err != nil {
		return "", fmt.Errorf("failed to create envelope: %w", err)
	}

	if !conn.EnqueueEvent(env) {
		return "", fmt.Errorf("failed to enqueue event: queue full")
	}

	return eventID, nil
}

func (eb *EventBus) HandleResponse(eventID string, resp *types.ResponsePayload) bool {
	eb.inflightMu.RLock()
	inflight, ok := eb.inflightReqs[eventID]
	eb.inflightMu.RUnlock()

	if !ok {
		return false
	}

	select {
	case inflight.ResponseCh <- resp:
		return true
	default:
		return false
	}
}

func (eb *EventBus) GetInflightCount() int {
	eb.inflightMu.RLock()
	defer eb.inflightMu.RUnlock()
	return len(eb.inflightReqs)
}
