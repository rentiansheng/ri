package adapter

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"

	"om/gateway/internal/eventbus"
	"om/gateway/internal/types"
)

type SlackAdapter struct {
	signingSecret string
}

func NewSlackAdapter(signingSecret string) *SlackAdapter {
	return &SlackAdapter{
		signingSecret: signingSecret,
	}
}

func (a *SlackAdapter) Platform() types.Platform {
	return types.PlatformSlack
}

func (a *SlackAdapter) VerifySignature(body []byte, headers map[string]string) bool {
	if a.signingSecret == "" {
		return true
	}

	timestamp := headers["x-slack-request-timestamp"]
	signature := headers["x-slack-signature"]

	if timestamp == "" || signature == "" {
		return false
	}

	baseString := fmt.Sprintf("v0:%s:%s", timestamp, string(body))
	mac := hmac.New(sha256.New, []byte(a.signingSecret))
	mac.Write([]byte(baseString))
	expected := "v0=" + hex.EncodeToString(mac.Sum(nil))

	return hmac.Equal([]byte(signature), []byte(expected))
}

func (a *SlackAdapter) ParseEvent(body []byte, headers map[string]string) (*eventbus.Event, error) {
	var payload map[string]interface{}
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, fmt.Errorf("failed to parse slack payload: %w", err)
	}

	eventType := "message"
	if t, ok := payload["type"].(string); ok {
		eventType = t
	}

	if eventType == "url_verification" {
		return &eventbus.Event{
			Platform:  types.PlatformSlack,
			EventType: "url_verification",
			Data:      payload,
		}, nil
	}

	if eventType == "event_callback" {
		if event, ok := payload["event"].(map[string]interface{}); ok {
			if t, ok := event["type"].(string); ok {
				eventType = t
			}
		}
	}

	return &eventbus.Event{
		Platform:  types.PlatformSlack,
		EventType: eventType,
		Data:      payload,
	}, nil
}

func (a *SlackAdapter) FormatResponse(resp *types.ResponsePayload) ([]byte, error) {
	return json.Marshal(resp.Body)
}

type DiscordAdapter struct {
	publicKey string
}

func NewDiscordAdapter(publicKey string) *DiscordAdapter {
	return &DiscordAdapter{
		publicKey: publicKey,
	}
}

func (a *DiscordAdapter) Platform() types.Platform {
	return types.PlatformDiscord
}

func (a *DiscordAdapter) VerifySignature(body []byte, headers map[string]string) bool {
	if a.publicKey == "" {
		return true
	}

	signature := headers["x-signature-ed25519"]
	timestamp := headers["x-signature-timestamp"]

	if signature == "" || timestamp == "" {
		return false
	}

	return true
}

func (a *DiscordAdapter) ParseEvent(body []byte, headers map[string]string) (*eventbus.Event, error) {
	var payload map[string]interface{}
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, fmt.Errorf("failed to parse discord payload: %w", err)
	}

	eventType := "interaction"
	if t, ok := payload["type"].(float64); ok {
		switch int(t) {
		case 1:
			eventType = "ping"
		case 2:
			eventType = "application_command"
		case 3:
			eventType = "message_component"
		case 4:
			eventType = "autocomplete"
		case 5:
			eventType = "modal_submit"
		}
	}

	return &eventbus.Event{
		Platform:  types.PlatformDiscord,
		EventType: eventType,
		Data:      payload,
	}, nil
}

func (a *DiscordAdapter) FormatResponse(resp *types.ResponsePayload) ([]byte, error) {
	return json.Marshal(resp.Body)
}

type GatewayAdapter struct{}

func NewGatewayAdapter() *GatewayAdapter {
	return &GatewayAdapter{}
}

func (a *GatewayAdapter) Platform() types.Platform {
	return types.PlatformGateway
}

func (a *GatewayAdapter) VerifySignature(body []byte, headers map[string]string) bool {
	return true
}

func (a *GatewayAdapter) ParseEvent(body []byte, headers map[string]string) (*eventbus.Event, error) {
	var payload types.EventPayload
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, fmt.Errorf("failed to parse gateway payload: %w", err)
	}

	return &eventbus.Event{
		ID:        payload.SessionID,
		Platform:  types.PlatformGateway,
		EventType: payload.EventType,
		Data:      payload.Data,
	}, nil
}

func (a *GatewayAdapter) FormatResponse(resp *types.ResponsePayload) ([]byte, error) {
	return json.Marshal(resp.Body)
}

func NormalizeHeaders(headers map[string][]string) map[string]string {
	result := make(map[string]string)
	for k, v := range headers {
		if len(v) > 0 {
			result[strings.ToLower(k)] = v[0]
		}
	}
	return result
}
