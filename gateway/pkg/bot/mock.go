package bot

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"om/gateway/internal/types"
)

type MockClient struct {
	GatewayURL string
	httpClient *http.Client
}

func NewMockClient(gatewayURL string) *MockClient {
	return &MockClient{
		GatewayURL: gatewayURL,
		httpClient: &http.Client{Timeout: 10 * time.Second},
	}
}

func (m *MockClient) SendSlackMessage(channelID, userID, text string) (*MockResponse, error) {
	return m.sendEvent(types.PlatformSlack, "message", map[string]interface{}{
		"channel_id": channelID,
		"user_id":    userID,
		"text":       text,
	}, true)
}

func (m *MockClient) SendGatewayMessage(channelID, userID, text string) (*MockResponse, error) {
	return m.sendEvent(types.PlatformGateway, "message", map[string]interface{}{
		"channel_id": channelID,
		"user_id":    userID,
		"text":       text,
	}, true)
}

func (m *MockClient) SendGatewayCommand(channelID, userID, command, text string) (*MockResponse, error) {
	return m.sendEvent(types.PlatformGateway, "slash_command", map[string]interface{}{
		"channel_id": channelID,
		"user_id":    userID,
		"command":    command,
		"text":       text,
	}, true)
}

func (m *MockClient) SendDiscordMessage(channelID, userID, text string) (*MockResponse, error) {
	return m.sendEvent(types.PlatformDiscord, "message", map[string]interface{}{
		"channel_id": channelID,
		"user_id":    userID,
		"text":       text,
	}, true)
}

func (m *MockClient) SendSlackCommand(channelID, userID, command, text string) (*MockResponse, error) {
	return m.sendEvent(types.PlatformSlack, "slash_command", map[string]interface{}{
		"channel_id": channelID,
		"user_id":    userID,
		"command":    command,
		"text":       text,
	}, true)
}

func (m *MockClient) sendEvent(platform types.Platform, eventType string, data map[string]interface{}, sync bool) (*MockResponse, error) {
	event := types.EventPayload{
		SessionID: fmt.Sprintf("mock-%d", time.Now().UnixNano()),
		Platform:  platform,
		EventType: eventType,
		Data:      data,
	}

	body, err := json.Marshal(event)
	if err != nil {
		return nil, err
	}

	endpoint := "/webhook/slack"
	switch platform {
	case types.PlatformDiscord:
		endpoint = "/webhook/discord"
	case types.PlatformGateway:
		endpoint = "/webhook/gateway"
	}
	if sync {
		endpoint += "/sync"
	}

	resp, err := m.httpClient.Post(m.GatewayURL+endpoint, "application/json", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	return &MockResponse{
		StatusCode: resp.StatusCode,
		Body:       string(respBody),
	}, nil
}

func (m *MockClient) GetHealth() (*HealthStatus, error) {
	resp, err := m.httpClient.Get(m.GatewayURL + "/health")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var health HealthStatus
	if err := json.NewDecoder(resp.Body).Decode(&health); err != nil {
		return nil, err
	}

	return &health, nil
}

func (m *MockClient) ListRIs() ([]types.RIInfo, error) {
	resp, err := m.httpClient.Get(m.GatewayURL + "/ri/list")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var ris []types.RIInfo
	if err := json.NewDecoder(resp.Body).Decode(&ris); err != nil {
		return nil, err
	}

	return ris, nil
}

type MockResponse struct {
	StatusCode int
	Body       string
}

type HealthStatus struct {
	Status    string `json:"status"`
	RICount   int    `json:"ri_count"`
	Inflight  int    `json:"inflight"`
	Timestamp int64  `json:"timestamp"`
}
