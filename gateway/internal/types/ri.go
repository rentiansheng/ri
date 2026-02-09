package types

import "time"

// RIState represents the state of an RI from its own perspective.
type RIState string

const (
	RIStateInit         RIState = "INIT"
	RIStateRegistering  RIState = "REGISTERING"
	RIStateConnected    RIState = "CONNECTED"
	RIStateDegraded     RIState = "DEGRADED"
	RIStateReconnecting RIState = "RECONNECTING"
	RIStateDisconnected RIState = "DISCONNECTED"
)

// GatewayRIState represents the state of an RI from Gateway's perspective.
type GatewayRIState string

const (
	GatewayRIStateOffline    GatewayRIState = "OFFLINE"
	GatewayRIStateRegistered GatewayRIState = "REGISTERED"
	GatewayRIStateOnline     GatewayRIState = "ONLINE"
	GatewayRIStateStale      GatewayRIState = "STALE"
)

// RIInfo holds registration and runtime information about a Remote Instance.
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
}

// RIRegistration is the payload for RI registration requests.
type RIRegistration struct {
	RIID           string            `json:"ri_id"`
	Version        string            `json:"version"`
	Capabilities   []string          `json:"capabilities"`
	MaxConcurrency int               `json:"max_concurrency"`
	Labels         map[string]string `json:"labels,omitempty"`
}
