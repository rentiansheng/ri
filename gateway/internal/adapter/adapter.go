package adapter

import (
	"om/gateway/internal/eventbus"
	"om/gateway/internal/types"
)

type Adapter interface {
	Platform() types.Platform
	ParseEvent(body []byte, headers map[string]string) (*eventbus.Event, error)
	VerifySignature(body []byte, headers map[string]string) bool
	FormatResponse(resp *types.ResponsePayload) ([]byte, error)
}

type AdapterRegistry struct {
	adapters map[types.Platform]Adapter
}

func NewAdapterRegistry() *AdapterRegistry {
	return &AdapterRegistry{
		adapters: make(map[types.Platform]Adapter),
	}
}

func (r *AdapterRegistry) Register(adapter Adapter) {
	r.adapters[adapter.Platform()] = adapter
}

func (r *AdapterRegistry) Get(platform types.Platform) Adapter {
	return r.adapters[platform]
}
