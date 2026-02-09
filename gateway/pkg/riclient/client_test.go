package riclient

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"om/gateway/internal/types"
)

func TestClient_Register(t *testing.T) {
	registered := false
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/ri/register" && r.Method == "POST" {
			registered = true
			var reg types.RIRegistration
			json.NewDecoder(r.Body).Decode(&reg)

			if reg.RIID == "" {
				t.Error("RIID should not be empty")
			}

			info := types.RIInfo{
				ID:      reg.RIID,
				Version: reg.Version,
				State:   types.GatewayRIStateOnline,
			}
			json.NewEncoder(w).Encode(info)
			return
		}
		http.NotFound(w, r)
	}))
	defer server.Close()

	cfg := DefaultConfig()
	cfg.GatewayURL = server.URL
	cfg.RIID = "test-ri"

	client := New(cfg)
	err := client.register()

	if err != nil {
		t.Fatalf("register failed: %v", err)
	}
	if !registered {
		t.Error("server did not receive registration")
	}
	if client.State() != StateConnected {
		t.Errorf("State = %v, want %v", client.State(), StateConnected)
	}
}

func TestClient_Poll(t *testing.T) {
	pollCount := int32(0)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/ri/register":
			json.NewEncoder(w).Encode(types.RIInfo{ID: "test-ri"})
		case "/ri/poll":
			atomic.AddInt32(&pollCount, 1)
			riID := r.Header.Get("X-RI-ID")
			if riID != "test-ri" {
				t.Errorf("X-RI-ID = %q, want %q", riID, "test-ri")
			}
			json.NewEncoder(w).Encode(map[string]interface{}{"events": []interface{}{}})
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	cfg := DefaultConfig()
	cfg.GatewayURL = server.URL
	cfg.RIID = "test-ri"
	cfg.PollTimeout = 100 * time.Millisecond

	client := New(cfg)
	client.ctx, client.cancel = context.WithCancel(context.Background())
	defer client.cancel()

	err := client.register()
	if err != nil {
		t.Fatalf("register failed: %v", err)
	}

	events, err := client.poll()
	if err != nil {
		t.Fatalf("poll failed: %v", err)
	}
	if len(events) != 0 {
		t.Errorf("events length = %d, want 0", len(events))
	}
}

func TestClient_SendHeartbeat(t *testing.T) {
	heartbeatReceived := false
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/ri/register":
			json.NewEncoder(w).Encode(types.RIInfo{ID: "test-ri"})
		case "/ri/heartbeat":
			heartbeatReceived = true
			riID := r.Header.Get("X-RI-ID")
			if riID != "test-ri" {
				t.Errorf("X-RI-ID = %q, want %q", riID, "test-ri")
			}

			var hb types.HeartbeatPayload
			json.NewDecoder(r.Body).Decode(&hb)

			if hb.Status != "ok" {
				t.Errorf("Status = %q, want %q", hb.Status, "ok")
			}
			w.WriteHeader(http.StatusOK)
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	cfg := DefaultConfig()
	cfg.GatewayURL = server.URL
	cfg.RIID = "test-ri"

	client := New(cfg)
	client.ctx, client.cancel = context.WithCancel(context.Background())
	defer client.cancel()

	err := client.register()
	if err != nil {
		t.Fatalf("register failed: %v", err)
	}

	err = client.sendHeartbeat()
	if err != nil {
		t.Fatalf("sendHeartbeat failed: %v", err)
	}
	if !heartbeatReceived {
		t.Error("server did not receive heartbeat")
	}
}

func TestClient_SendResponse(t *testing.T) {
	responseReceived := false
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/ri/register":
			json.NewEncoder(w).Encode(types.RIInfo{ID: "test-ri"})
		case "/ri/response":
			responseReceived = true

			var env types.Envelope
			json.NewDecoder(r.Body).Decode(&env)

			if env.Type != types.MessageTypeResponse {
				t.Errorf("Type = %q, want %q", env.Type, types.MessageTypeResponse)
			}
			if env.ID != "evt-123" {
				t.Errorf("ID = %q, want %q", env.ID, "evt-123")
			}
			w.WriteHeader(http.StatusOK)
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	cfg := DefaultConfig()
	cfg.GatewayURL = server.URL
	cfg.RIID = "test-ri"

	client := New(cfg)
	client.ctx, client.cancel = context.WithCancel(context.Background())
	defer client.cancel()

	err := client.register()
	if err != nil {
		t.Fatalf("register failed: %v", err)
	}

	resp := &types.ResponsePayload{
		Platform: types.PlatformSlack,
		Body:     map[string]interface{}{"text": "hello"},
	}

	err = client.sendResponse("evt-123", resp)
	if err != nil {
		t.Fatalf("sendResponse failed: %v", err)
	}
	if !responseReceived {
		t.Error("server did not receive response")
	}
}

func TestClient_StateTransitions(t *testing.T) {
	states := []ClientState{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/ri/register":
			json.NewEncoder(w).Encode(types.RIInfo{ID: "test-ri"})
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	cfg := DefaultConfig()
	cfg.GatewayURL = server.URL
	cfg.RIID = "test-ri"

	client := New(cfg)
	client.OnStateChange = func(old, new ClientState) {
		states = append(states, new)
	}

	err := client.register()
	if err != nil {
		t.Fatalf("register failed: %v", err)
	}

	if len(states) < 2 {
		t.Fatalf("expected at least 2 state changes, got %d", len(states))
	}
	if states[0] != StateRegistering {
		t.Errorf("states[0] = %v, want %v", states[0], StateRegistering)
	}
	if states[1] != StateConnected {
		t.Errorf("states[1] = %v, want %v", states[1], StateConnected)
	}
}

func TestClient_Handler(t *testing.T) {
	handlerCalled := false
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/ri/register":
			json.NewEncoder(w).Encode(types.RIInfo{ID: "test-ri"})
		case "/ri/response":
			w.WriteHeader(http.StatusOK)
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	cfg := DefaultConfig()
	cfg.GatewayURL = server.URL
	cfg.RIID = "test-ri"

	client := New(cfg)
	client.ctx, client.cancel = context.WithCancel(context.Background())
	defer client.cancel()

	client.SetHandler(func(ctx context.Context, env *types.Envelope) (*types.ResponsePayload, error) {
		handlerCalled = true
		return &types.ResponsePayload{
			Platform: types.PlatformSlack,
			Body:     map[string]interface{}{"text": "response"},
		}, nil
	})

	eventPayload, _ := json.Marshal(types.EventPayload{
		SessionID: "test",
		Platform:  types.PlatformSlack,
	})
	env := &types.Envelope{
		Type:    types.MessageTypeEvent,
		ID:      "evt-1",
		Payload: eventPayload,
	}

	client.handleEvent(env)
	time.Sleep(100 * time.Millisecond)

	if !handlerCalled {
		t.Error("handler was not called")
	}
}

func TestDefaultConfig(t *testing.T) {
	cfg := DefaultConfig()

	if cfg.GatewayURL == "" {
		t.Error("GatewayURL should have default")
	}
	if cfg.PollTimeout == 0 {
		t.Error("PollTimeout should have default")
	}
	if cfg.HeartbeatInterval == 0 {
		t.Error("HeartbeatInterval should have default")
	}
	if cfg.MaxConcurrency == 0 {
		t.Error("MaxConcurrency should have default")
	}
}
