package server

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"om/gateway/internal/adapter"
	"om/gateway/internal/connection"
	"om/gateway/internal/eventbus"
	"om/gateway/internal/registry"
	"om/gateway/internal/types"
)

type Server struct {
	httpServer *http.Server
	mux        *http.ServeMux
	registry   *registry.Registry
	connMgr    *connection.ConnectionManager
	eventBus   *eventbus.EventBus
	adapters   *adapter.AdapterRegistry

	pollTimeout time.Duration
}

type Config struct {
	Addr        string
	PollTimeout time.Duration
}

func New(cfg Config, reg *registry.Registry, connMgr *connection.ConnectionManager, eb *eventbus.EventBus, adapters *adapter.AdapterRegistry) *Server {
	if cfg.PollTimeout == 0 {
		cfg.PollTimeout = 30 * time.Second
	}

	s := &Server{
		registry:    reg,
		connMgr:     connMgr,
		eventBus:    eb,
		adapters:    adapters,
		pollTimeout: cfg.PollTimeout,
	}

	mux := http.NewServeMux()
	s.mux = mux

	mux.HandleFunc("POST /ri/register", s.handleRIRegister)
	mux.HandleFunc("GET /ri/poll", s.handleRIPoll)
	mux.HandleFunc("POST /ri/response", s.handleRIResponse)
	mux.HandleFunc("POST /ri/heartbeat", s.handleRIHeartbeat)

	mux.HandleFunc("POST /webhook/slack", s.handleSlackWebhook)
	mux.HandleFunc("POST /webhook/discord", s.handleDiscordWebhook)
	mux.HandleFunc("POST /webhook/gateway", s.handleGatewayWebhook)
	mux.HandleFunc("POST /webhook/slack/sync", s.handleSlackWebhookSync)
	mux.HandleFunc("POST /webhook/discord/sync", s.handleDiscordWebhookSync)
	mux.HandleFunc("POST /webhook/gateway/sync", s.handleGatewayWebhookSync)

	mux.HandleFunc("GET /health", s.handleHealth)
	mux.HandleFunc("GET /ri/list", s.handleRIList)

	s.httpServer = &http.Server{
		Addr:         cfg.Addr,
		Handler:      mux,
		ReadTimeout:  60 * time.Second,
		WriteTimeout: 60 * time.Second,
	}

	return s
}

func (s *Server) Mux() *http.ServeMux {
	return s.mux
}

func (s *Server) Start() error {
	log.Printf("Gateway server starting on %s", s.httpServer.Addr)
	return s.httpServer.ListenAndServe()
}

func (s *Server) Shutdown(ctx context.Context) error {
	return s.httpServer.Shutdown(ctx)
}

func (s *Server) handleRIRegister(w http.ResponseWriter, r *http.Request) {
	var reg types.RIRegistration
	if err := json.NewDecoder(r.Body).Decode(&reg); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	info, err := s.registry.Register(&reg)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(info)
}

func (s *Server) handleRIPoll(w http.ResponseWriter, r *http.Request) {
	riID := r.Header.Get("X-RI-ID")
	if riID == "" {
		http.Error(w, "missing X-RI-ID header", http.StatusBadRequest)
		return
	}

	conn := s.connMgr.Get(riID)
	if conn == nil {
		http.Error(w, "RI not registered", http.StatusNotFound)
		return
	}

	events := conn.Poll(s.pollTimeout)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"events": events,
	})
}

func (s *Server) handleRIResponse(w http.ResponseWriter, r *http.Request) {
	riID := r.Header.Get("X-RI-ID")
	if riID == "" {
		http.Error(w, "missing X-RI-ID header", http.StatusBadRequest)
		return
	}

	var env types.Envelope
	if err := json.NewDecoder(r.Body).Decode(&env); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if env.Type != types.MessageTypeResponse {
		http.Error(w, "expected response message type", http.StatusBadRequest)
		return
	}

	var resp types.ResponsePayload
	if err := json.Unmarshal(env.Payload, &resp); err != nil {
		http.Error(w, "invalid response payload", http.StatusBadRequest)
		return
	}

	s.eventBus.HandleResponse(env.ID, &resp)

	w.WriteHeader(http.StatusOK)
}

func (s *Server) handleRIHeartbeat(w http.ResponseWriter, r *http.Request) {
	riID := r.Header.Get("X-RI-ID")
	if riID == "" {
		http.Error(w, "missing X-RI-ID header", http.StatusBadRequest)
		return
	}

	var hb types.HeartbeatPayload
	if err := json.NewDecoder(r.Body).Decode(&hb); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if !s.registry.UpdateHeartbeat(riID, &hb) {
		http.Error(w, "RI not registered", http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (s *Server) handleSlackWebhook(w http.ResponseWriter, r *http.Request) {
	s.handleWebhook(w, r, types.PlatformSlack)
}

func (s *Server) handleDiscordWebhook(w http.ResponseWriter, r *http.Request) {
	s.handleWebhook(w, r, types.PlatformDiscord)
}

func (s *Server) handleSlackWebhookSync(w http.ResponseWriter, r *http.Request) {
	s.handleWebhookSync(w, r, types.PlatformSlack)
}

func (s *Server) handleDiscordWebhookSync(w http.ResponseWriter, r *http.Request) {
	s.handleWebhookSync(w, r, types.PlatformDiscord)
}

func (s *Server) handleGatewayWebhook(w http.ResponseWriter, r *http.Request) {
	s.handleWebhook(w, r, types.PlatformGateway)
}

func (s *Server) handleGatewayWebhookSync(w http.ResponseWriter, r *http.Request) {
	s.handleWebhookSync(w, r, types.PlatformGateway)
}

// handleWebhookSync handles webhook events synchronously, waiting for RI response.
// Used for testing/interactive mode where caller needs the actual response.
func (s *Server) handleWebhookSync(w http.ResponseWriter, r *http.Request, platform types.Platform) {
	adp := s.adapters.Get(platform)
	if adp == nil {
		http.Error(w, "platform not supported", http.StatusNotImplemented)
		return
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "failed to read body", http.StatusBadRequest)
		return
	}

	headers := adapter.NormalizeHeaders(r.Header)

	if !adp.VerifySignature(body, headers) {
		http.Error(w, "invalid signature", http.StatusUnauthorized)
		return
	}

	event, err := adp.ParseEvent(body, headers)
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to parse event: %v", err), http.StatusBadRequest)
		return
	}

	if platform == types.PlatformSlack && event.EventType == "url_verification" {
		if challenge, ok := event.Data["challenge"].(string); ok {
			w.Header().Set("Content-Type", "text/plain")
			w.Write([]byte(challenge))
			return
		}
	}

	if platform == types.PlatformDiscord && event.EventType == "ping" {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]int{"type": 1})
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 25*time.Second)
	defer cancel()

	resp, err := s.eventBus.Publish(ctx, event)
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to process event: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if resp != nil {
		json.NewEncoder(w).Encode(resp)
	} else {
		json.NewEncoder(w).Encode(map[string]string{"status": "processed", "message": "no response from RI"})
	}
}

func (s *Server) handleWebhook(w http.ResponseWriter, r *http.Request, platform types.Platform) {
	adp := s.adapters.Get(platform)
	if adp == nil {
		http.Error(w, "platform not supported", http.StatusNotImplemented)
		return
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "failed to read body", http.StatusBadRequest)
		return
	}

	headers := adapter.NormalizeHeaders(r.Header)

	if !adp.VerifySignature(body, headers) {
		http.Error(w, "invalid signature", http.StatusUnauthorized)
		return
	}

	event, err := adp.ParseEvent(body, headers)
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to parse event: %v", err), http.StatusBadRequest)
		return
	}

	if platform == types.PlatformSlack && event.EventType == "url_verification" {
		if challenge, ok := event.Data["challenge"].(string); ok {
			w.Header().Set("Content-Type", "text/plain")
			w.Write([]byte(challenge))
			return
		}
	}

	if platform == types.PlatformDiscord && event.EventType == "ping" {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]int{"type": 1})
		return
	}

	w.WriteHeader(http.StatusOK)

	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 25*time.Second)
		defer cancel()

		resp, err := s.eventBus.Publish(ctx, event)
		if err != nil {
			log.Printf("failed to publish event: %v", err)
			return
		}

		if resp != nil && resp.ResponseURL != "" {
			s.sendDelayedResponse(resp)
		}
	}()
}

func (s *Server) sendDelayedResponse(resp *types.ResponsePayload) {
	adp := s.adapters.Get(resp.Platform)
	if adp == nil {
		return
	}

	body, err := adp.FormatResponse(resp)
	if err != nil {
		log.Printf("failed to format response: %v", err)
		return
	}

	httpResp, err := http.Post(resp.ResponseURL, "application/json", io.NopCloser(jsonReader(body)))
	if err != nil {
		log.Printf("failed to send delayed response: %v", err)
		return
	}
	httpResp.Body.Close()
}

func jsonReader(data []byte) io.Reader {
	return &jsonReaderImpl{data: data}
}

type jsonReaderImpl struct {
	data []byte
	pos  int
}

func (r *jsonReaderImpl) Read(p []byte) (n int, err error) {
	if r.pos >= len(r.data) {
		return 0, io.EOF
	}
	n = copy(p, r.data[r.pos:])
	r.pos += n
	return n, nil
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":    "ok",
		"ri_count":  len(s.registry.GetAll()),
		"inflight":  s.eventBus.GetInflightCount(),
		"timestamp": time.Now().Unix(),
	})
}

func (s *Server) handleRIList(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(s.registry.GetAll())
}
