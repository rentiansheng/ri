package connection

import (
	"context"
	"sync"
	"time"

	"om/gateway/internal/types"
)

const (
	DefaultPollTimeout    = 30 * time.Second
	DefaultEventQueueSize = 100
)

type PendingRequest struct {
	EventID    string
	Event      *types.Envelope
	CreatedAt  time.Time
	ResponseCh chan *types.Envelope
}

type RIConnection struct {
	RIID         string
	Info         *types.RIInfo
	eventQueue   chan *types.Envelope
	pendingReqs  map[string]*PendingRequest
	pendingMu    sync.RWMutex
	lastPollTime time.Time
	pollMu       sync.Mutex
	ctx          context.Context
	cancel       context.CancelFunc
}

func NewRIConnection(riID string, info *types.RIInfo) *RIConnection {
	ctx, cancel := context.WithCancel(context.Background())
	return &RIConnection{
		RIID:        riID,
		Info:        info,
		eventQueue:  make(chan *types.Envelope, DefaultEventQueueSize),
		pendingReqs: make(map[string]*PendingRequest),
		ctx:         ctx,
		cancel:      cancel,
	}
}

func (c *RIConnection) EnqueueEvent(env *types.Envelope) bool {
	select {
	case c.eventQueue <- env:
		return true
	default:
		return false
	}
}

func (c *RIConnection) Poll(timeout time.Duration) []*types.Envelope {
	c.pollMu.Lock()
	c.lastPollTime = time.Now()
	c.pollMu.Unlock()

	var events []*types.Envelope

	select {
	case env := <-c.eventQueue:
		events = append(events, env)
		for {
			select {
			case env := <-c.eventQueue:
				events = append(events, env)
			default:
				return events
			}
		}
	case <-time.After(timeout):
		return events
	case <-c.ctx.Done():
		return events
	}
}

func (c *RIConnection) AddPendingRequest(eventID string, env *types.Envelope) *PendingRequest {
	req := &PendingRequest{
		EventID:    eventID,
		Event:      env,
		CreatedAt:  time.Now(),
		ResponseCh: make(chan *types.Envelope, 1),
	}
	c.pendingMu.Lock()
	c.pendingReqs[eventID] = req
	c.pendingMu.Unlock()
	return req
}

func (c *RIConnection) CompletePendingRequest(eventID string, response *types.Envelope) bool {
	c.pendingMu.Lock()
	req, ok := c.pendingReqs[eventID]
	if ok {
		delete(c.pendingReqs, eventID)
	}
	c.pendingMu.Unlock()

	if ok && req.ResponseCh != nil {
		select {
		case req.ResponseCh <- response:
			return true
		default:
			return false
		}
	}
	return false
}

func (c *RIConnection) GetPendingRequest(eventID string) *PendingRequest {
	c.pendingMu.RLock()
	defer c.pendingMu.RUnlock()
	return c.pendingReqs[eventID]
}

func (c *RIConnection) LastPollTime() time.Time {
	c.pollMu.Lock()
	defer c.pollMu.Unlock()
	return c.lastPollTime
}

func (c *RIConnection) Close() {
	c.cancel()
	close(c.eventQueue)
}

type ConnectionManager struct {
	connections map[string]*RIConnection
	mu          sync.RWMutex
}

func NewConnectionManager() *ConnectionManager {
	return &ConnectionManager{
		connections: make(map[string]*RIConnection),
	}
}

func (m *ConnectionManager) Register(riID string, info *types.RIInfo) *RIConnection {
	m.mu.Lock()
	defer m.mu.Unlock()

	if existing, ok := m.connections[riID]; ok {
		existing.Close()
	}

	conn := NewRIConnection(riID, info)
	m.connections[riID] = conn
	return conn
}

func (m *ConnectionManager) Get(riID string) *RIConnection {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.connections[riID]
}

func (m *ConnectionManager) Remove(riID string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if conn, ok := m.connections[riID]; ok {
		conn.Close()
		delete(m.connections, riID)
	}
}

func (m *ConnectionManager) GetAll() []*RIConnection {
	m.mu.RLock()
	defer m.mu.RUnlock()

	conns := make([]*RIConnection, 0, len(m.connections))
	for _, conn := range m.connections {
		conns = append(conns, conn)
	}
	return conns
}

func (m *ConnectionManager) Broadcast(env *types.Envelope) int {
	m.mu.RLock()
	defer m.mu.RUnlock()

	count := 0
	for _, conn := range m.connections {
		if conn.EnqueueEvent(env) {
			count++
		}
	}
	return count
}
