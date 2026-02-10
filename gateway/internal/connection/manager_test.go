package connection

import (
	"testing"
	"time"

	"om/gateway/internal/types"
)

func TestRIConnection_EnqueueAndPoll(t *testing.T) {
	info := &types.RIInfo{ID: "test-ri"}
	conn := NewRIConnection("test-ri", info)
	defer conn.Close()

	env, _ := types.NewEnvelope(types.MessageTypeEvent, "test-1", map[string]string{"foo": "bar"})
	if !conn.EnqueueEvent(env) {
		t.Error("expected enqueue to succeed")
	}

	events := conn.Poll(100 * time.Millisecond)
	if len(events) != 1 {
		t.Errorf("expected 1 event, got %d", len(events))
	}

	if events[0].ID != "test-1" {
		t.Errorf("expected event ID 'test-1', got '%s'", events[0].ID)
	}
}

func TestRIConnection_PollTimeout(t *testing.T) {
	info := &types.RIInfo{ID: "test-ri"}
	conn := NewRIConnection("test-ri", info)
	defer conn.Close()

	start := time.Now()
	events := conn.Poll(50 * time.Millisecond)
	elapsed := time.Since(start)

	if len(events) != 0 {
		t.Errorf("expected 0 events, got %d", len(events))
	}

	if elapsed < 50*time.Millisecond {
		t.Error("expected poll to wait for timeout")
	}
}

func TestRIConnection_PendingRequest(t *testing.T) {
	info := &types.RIInfo{ID: "test-ri"}
	conn := NewRIConnection("test-ri", info)
	defer conn.Close()

	env, _ := types.NewEnvelope(types.MessageTypeEvent, "req-1", nil)
	req := conn.AddPendingRequest("req-1", env)

	if req == nil {
		t.Fatal("expected pending request to be created")
	}

	if conn.GetPendingRequest("req-1") == nil {
		t.Error("expected to get pending request")
	}

	respEnv, _ := types.NewEnvelope(types.MessageTypeResponse, "req-1", nil)
	if !conn.CompletePendingRequest("req-1", respEnv) {
		t.Error("expected complete to succeed")
	}

	if conn.GetPendingRequest("req-1") != nil {
		t.Error("expected pending request to be removed after completion")
	}
}

func TestConnectionManager_RegisterAndGet(t *testing.T) {
	mgr := NewConnectionManager()

	info := &types.RIInfo{ID: "ri-1"}
	conn := mgr.Register("ri-1", info)

	if conn == nil {
		t.Fatal("expected connection to be created")
	}

	retrieved := mgr.Get("ri-1")
	if retrieved == nil {
		t.Error("expected to retrieve connection")
	}

	if retrieved.RIID != "ri-1" {
		t.Errorf("expected RIID 'ri-1', got '%s'", retrieved.RIID)
	}
}

func TestConnectionManager_Remove(t *testing.T) {
	mgr := NewConnectionManager()

	info := &types.RIInfo{ID: "ri-1"}
	mgr.Register("ri-1", info)
	mgr.Remove("ri-1")

	if mgr.Get("ri-1") != nil {
		t.Error("expected connection to be removed")
	}
}

func TestConnectionManager_Broadcast(t *testing.T) {
	mgr := NewConnectionManager()

	mgr.Register("ri-1", &types.RIInfo{ID: "ri-1"})
	mgr.Register("ri-2", &types.RIInfo{ID: "ri-2"})

	env, _ := types.NewEnvelope(types.MessageTypeEvent, "broadcast-1", nil)
	count := mgr.Broadcast(env)

	if count != 2 {
		t.Errorf("expected broadcast to 2 connections, got %d", count)
	}
}
