package registry

import (
	"sync"
	"time"

	"om/gateway/internal/connection"
	"om/gateway/internal/types"
)

const (
	DefaultHeartbeatInterval = 10 * time.Second
	DefaultHeartbeatTimeout  = 25 * time.Second
	DefaultStaleTimeout      = 60 * time.Second
)

type Registry struct {
	connMgr         *connection.ConnectionManager
	riInfos         map[string]*types.RIInfo
	capabilityIndex map[string][]string
	mu              sync.RWMutex

	heartbeatInterval time.Duration
	heartbeatTimeout  time.Duration
	staleTimeout      time.Duration

	stopCh chan struct{}
}

func New(connMgr *connection.ConnectionManager) *Registry {
	return &Registry{
		connMgr:           connMgr,
		riInfos:           make(map[string]*types.RIInfo),
		capabilityIndex:   make(map[string][]string),
		heartbeatInterval: DefaultHeartbeatInterval,
		heartbeatTimeout:  DefaultHeartbeatTimeout,
		staleTimeout:      DefaultStaleTimeout,
		stopCh:            make(chan struct{}),
	}
}

func (r *Registry) Register(reg *types.RIRegistration) (*types.RIInfo, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	now := time.Now()
	info := &types.RIInfo{
		ID:             reg.RIID,
		Version:        reg.Version,
		Capabilities:   reg.Capabilities,
		MaxConcurrency: reg.MaxConcurrency,
		Labels:         reg.Labels,
		State:          types.GatewayRIStateRegistered,
		LastHeartbeat:  now,
		ConnectedAt:    now,
	}

	r.riInfos[reg.RIID] = info
	r.updateCapabilityIndex(reg.RIID, reg.Capabilities)
	r.connMgr.Register(reg.RIID, info)

	return info, nil
}

func (r *Registry) Unregister(riID string) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if info, ok := r.riInfos[riID]; ok {
		r.removeFromCapabilityIndex(riID, info.Capabilities)
		delete(r.riInfos, riID)
		r.connMgr.Remove(riID)
	}
}

func (r *Registry) UpdateHeartbeat(riID string, hb *types.HeartbeatPayload) bool {
	r.mu.Lock()
	defer r.mu.Unlock()

	info, ok := r.riInfos[riID]
	if !ok {
		return false
	}

	info.LastHeartbeat = time.Now()
	info.Load = hb.Load
	info.Inflight = hb.Inflight

	if hb.Status == "ok" && info.State == types.GatewayRIStateStale {
		info.State = types.GatewayRIStateOnline
	} else if hb.Status == "degraded" {
		info.State = types.GatewayRIStateStale
	} else if info.State == types.GatewayRIStateRegistered {
		info.State = types.GatewayRIStateOnline
	}

	return true
}

func (r *Registry) Get(riID string) *types.RIInfo {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.riInfos[riID]
}

func (r *Registry) GetByCapability(capability string) []*types.RIInfo {
	r.mu.RLock()
	defer r.mu.RUnlock()

	riIDs := r.capabilityIndex[capability]
	var result []*types.RIInfo
	for _, id := range riIDs {
		if info, ok := r.riInfos[id]; ok && (info.State == types.GatewayRIStateOnline || info.State == types.GatewayRIStateRegistered) {
			result = append(result, info)
		}
	}
	return result
}

func (r *Registry) GetAll() []*types.RIInfo {
	r.mu.RLock()
	defer r.mu.RUnlock()

	result := make([]*types.RIInfo, 0, len(r.riInfos))
	for _, info := range r.riInfos {
		result = append(result, info)
	}
	return result
}

func (r *Registry) SelectRI(capability string) *types.RIInfo {
	candidates := r.GetByCapability(capability)
	if len(candidates) == 0 {
		return nil
	}

	var best *types.RIInfo
	for _, info := range candidates {
		if info.Inflight >= info.MaxConcurrency {
			continue
		}
		if best == nil || info.Load < best.Load {
			best = info
		}
	}
	return best
}

func (r *Registry) StartHealthCheck() {
	go r.healthCheckLoop()
}

func (r *Registry) Stop() {
	close(r.stopCh)
}

func (r *Registry) healthCheckLoop() {
	ticker := time.NewTicker(r.heartbeatInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			r.checkHealth()
		case <-r.stopCh:
			return
		}
	}
}

func (r *Registry) checkHealth() {
	r.mu.Lock()
	defer r.mu.Unlock()

	now := time.Now()
	for riID, info := range r.riInfos {
		elapsed := now.Sub(info.LastHeartbeat)

		switch {
		case elapsed > r.staleTimeout:
			info.State = types.GatewayRIStateOffline
			r.connMgr.Remove(riID)
		case elapsed > r.heartbeatTimeout:
			if info.State == types.GatewayRIStateOnline {
				info.State = types.GatewayRIStateStale
			}
		}
	}
}

func (r *Registry) updateCapabilityIndex(riID string, capabilities []string) {
	for _, cap := range capabilities {
		r.capabilityIndex[cap] = append(r.capabilityIndex[cap], riID)
	}
}

func (r *Registry) removeFromCapabilityIndex(riID string, capabilities []string) {
	for _, cap := range capabilities {
		ids := r.capabilityIndex[cap]
		for i, id := range ids {
			if id == riID {
				r.capabilityIndex[cap] = append(ids[:i], ids[i+1:]...)
				break
			}
		}
	}
}
