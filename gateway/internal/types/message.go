// Package types defines core data structures for the Gateway system.
package types

import (
	"encoding/json"
	"time"
)

// MessageType represents the type of message in the protocol.
type MessageType string

const (
	MessageTypeEvent     MessageType = "event"
	MessageTypeResponse  MessageType = "response"
	MessageTypeHeartbeat MessageType = "heartbeat"
	MessageTypeControl   MessageType = "control"
	MessageTypeError     MessageType = "error"
)

// Envelope is the universal message wrapper for all Gateway ↔ RI communication.
type Envelope struct {
	Type      MessageType     `json:"type"`
	ID        string          `json:"id"`
	Timestamp int64           `json:"timestamp"`
	Payload   json.RawMessage `json:"payload"`
}

// NewEnvelope creates a new envelope with the given type and payload.
func NewEnvelope(msgType MessageType, id string, payload interface{}) (*Envelope, error) {
	data, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	return &Envelope{
		Type:      msgType,
		ID:        id,
		Timestamp: time.Now().Unix(),
		Payload:   data,
	}, nil
}

// Platform represents the source platform of an event.
type Platform string

const (
	PlatformSlack   Platform = "slack"
	PlatformDiscord Platform = "discord"
	PlatformGateway Platform = "gateway"
)

// EventPayload represents an event sent from Gateway to RI.
type EventPayload struct {
	SessionID string                 `json:"session_id"`
	Platform  Platform               `json:"platform"`
	EventType string                 `json:"event_type"`
	Data      map[string]interface{} `json:"data"`
}

// ResponsePayload represents a response sent from RI to Gateway.
type ResponsePayload struct {
	Platform    Platform               `json:"platform"`
	ResponseURL string                 `json:"response_url,omitempty"`
	Body        map[string]interface{} `json:"body"`
}

// HeartbeatPayload represents heartbeat data from RI.
type HeartbeatPayload struct {
	Status   string  `json:"status"` // "ok" or "degraded"
	Load     float64 `json:"load"`
	Inflight int     `json:"inflight"`
}

// ControlAction represents control plane actions.
type ControlAction string

const (
	ControlActionDrain    ControlAction = "drain"
	ControlActionPause    ControlAction = "pause"
	ControlActionResume   ControlAction = "resume"
	ControlActionShutdown ControlAction = "shutdown"
)

// ControlPayload represents a control message from Gateway to RI.
type ControlPayload struct {
	Action ControlAction `json:"action"`
	Reason string        `json:"reason,omitempty"`
}

// ErrorPayload represents an error message.
type ErrorPayload struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}
