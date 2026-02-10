package types

import (
	"encoding/json"
	"time"
)

type RIState string

const (
	RIStateInit         RIState = "INIT"
	RIStateRegistering  RIState = "REGISTERING"
	RIStateConnected    RIState = "CONNECTED"
	RIStateDegraded     RIState = "DEGRADED"
	RIStateReconnecting RIState = "RECONNECTING"
	RIStateDisconnected RIState = "DISCONNECTED"
)

type GatewayRIState string

const (
	GatewayRIStateOffline    GatewayRIState = "OFFLINE"
	GatewayRIStateRegistered GatewayRIState = "REGISTERED"
	GatewayRIStateOnline     GatewayRIState = "ONLINE"
	GatewayRIStateStale      GatewayRIState = "STALE"
)

type RIInfo struct {
	ID             string            `json:"ri_id"`
	Version        string            `json:"version"`
	Capabilities   []string          `json:"capabilities"`
	MaxConcurrency int               `json:"max_concurrency"`
	Labels         map[string]string `json:"labels,omitempty"`

	State         GatewayRIState `json:"state"`
	LastHeartbeat time.Time      `json:"last_heartbeat"`
	ConnectedAt   time.Time      `json:"connected_at"`
	Load          float64        `json:"load"`
	Inflight      int            `json:"inflight"`

	RemoteConfig *RIRemoteConfig `json:"-"`
}

type RIRegistration struct {
	RIID           string            `json:"ri_id"`
	Version        string            `json:"version"`
	Capabilities   []string          `json:"capabilities"`
	MaxConcurrency int               `json:"max_concurrency"`
	Labels         map[string]string `json:"labels,omitempty"`
	RemoteConfig   json.RawMessage   `json:"remote_config,omitempty"`
}

type EncryptedPayload struct {
	Encrypted bool            `json:"encrypted"`
	IV        string          `json:"iv,omitempty"`
	AuthTag   string          `json:"authTag,omitempty"`
	Data      json.RawMessage `json:"data"`
}

type RIRemoteConfig struct {
	Discord      DiscordRemoteConfig      `json:"discord"`
	Slack        SlackRemoteConfig        `json:"slack"`
	Notification NotificationRemoteConfig `json:"notification"`
}

type DiscordRemoteConfig struct {
	Enabled   bool   `json:"enabled"`
	Token     string `json:"token"`
	ChannelID string `json:"channelId"`
}

type SlackRemoteConfig struct {
	Enabled   bool   `json:"enabled"`
	Token     string `json:"token"`
	ChannelID string `json:"channelId"`
}

type NotificationRemoteConfig struct {
	Enabled   bool `json:"enabled"`
	ShowAgent bool `json:"showAgent"`
	Sound     bool `json:"sound"`
}
