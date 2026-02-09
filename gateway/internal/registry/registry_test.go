package registry

import (
	"testing"
	"time"

	"om/gateway/internal/connection"
	"om/gateway/internal/types"
)

func TestRegistry_Register(t *testing.T) {
	connMgr := connection.NewConnectionManager()
	reg := New(connMgr)

	registration := &types.RIRegistration{
		RIID:           "test-ri-1",
		Version:        "1.0.0",
		Capabilities:   []string{"slack.message", "discord.command"},
		MaxConcurrency: 4,
		Labels:         map[string]string{"env": "test"},
	}

	info, err := reg.Register(registration)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if info.ID != "test-ri-1" {
		t.Errorf("expected ID 'test-ri-1', got '%s'", info.ID)
	}

	if info.State != types.GatewayRIStateRegistered {
		t.Errorf("expected state REGISTERED, got %s", info.State)
	}

	retrieved := reg.Get("test-ri-1")
	if retrieved == nil {
		t.Fatal("expected to retrieve registered RI")
	}
}

func TestRegistry_GetByCapability(t *testing.T) {
	connMgr := connection.NewConnectionManager()
	reg := New(connMgr)

	reg.Register(&types.RIRegistration{
		RIID:           "ri-1",
		Capabilities:   []string{"slack.message"},
		MaxConcurrency: 4,
	})

	reg.Register(&types.RIRegistration{
		RIID:           "ri-2",
		Capabilities:   []string{"slack.message", "discord.command"},
		MaxConcurrency: 4,
	})

	reg.UpdateHeartbeat("ri-1", &types.HeartbeatPayload{Status: "ok"})
	reg.UpdateHeartbeat("ri-2", &types.HeartbeatPayload{Status: "ok"})

	slackRIs := reg.GetByCapability("slack.message")
	if len(slackRIs) != 2 {
		t.Errorf("expected 2 RIs with slack.message, got %d", len(slackRIs))
	}

	discordRIs := reg.GetByCapability("discord.command")
	if len(discordRIs) != 1 {
		t.Errorf("expected 1 RI with discord.command, got %d", len(discordRIs))
	}
}

func TestRegistry_SelectRI(t *testing.T) {
	connMgr := connection.NewConnectionManager()
	reg := New(connMgr)

	reg.Register(&types.RIRegistration{
		RIID:           "ri-high-load",
		Capabilities:   []string{"slack.message"},
		MaxConcurrency: 4,
	})
	reg.UpdateHeartbeat("ri-high-load", &types.HeartbeatPayload{Status: "ok", Load: 0.9})

	reg.Register(&types.RIRegistration{
		RIID:           "ri-low-load",
		Capabilities:   []string{"slack.message"},
		MaxConcurrency: 4,
	})
	reg.UpdateHeartbeat("ri-low-load", &types.HeartbeatPayload{Status: "ok", Load: 0.2})

	selected := reg.SelectRI("slack.message")
	if selected == nil {
		t.Fatal("expected to select an RI")
	}

	if selected.ID != "ri-low-load" {
		t.Errorf("expected to select ri-low-load (lower load), got %s", selected.ID)
	}
}

func TestRegistry_Unregister(t *testing.T) {
	connMgr := connection.NewConnectionManager()
	reg := New(connMgr)

	reg.Register(&types.RIRegistration{
		RIID:           "test-ri",
		Capabilities:   []string{"slack.message"},
		MaxConcurrency: 4,
	})

	reg.Unregister("test-ri")

	if reg.Get("test-ri") != nil {
		t.Error("expected RI to be unregistered")
	}
}

func TestRegistry_HealthCheck(t *testing.T) {
	connMgr := connection.NewConnectionManager()
	reg := New(connMgr)
	reg.heartbeatTimeout = 10 * time.Millisecond
	reg.staleTimeout = 20 * time.Millisecond

	reg.Register(&types.RIRegistration{
		RIID:           "test-ri",
		Capabilities:   []string{"slack.message"},
		MaxConcurrency: 4,
	})
	reg.UpdateHeartbeat("test-ri", &types.HeartbeatPayload{Status: "ok"})

	info := reg.Get("test-ri")
	if info.State != types.GatewayRIStateOnline {
		t.Errorf("expected ONLINE state, got %s", info.State)
	}

	time.Sleep(15 * time.Millisecond)
	reg.checkHealth()

	info = reg.Get("test-ri")
	if info.State != types.GatewayRIStateStale {
		t.Errorf("expected STALE state after timeout, got %s", info.State)
	}
}
