package webui

import (
	"context"
	"encoding/json"
	"html/template"
	"net/http"
	"time"

	"om/gateway/internal/eventbus"
	"om/gateway/internal/registry"
	"om/gateway/internal/types"
)

type Handler struct {
	auth     *AuthManager
	registry *registry.Registry
	eventBus *eventbus.EventBus
	enabled  bool
}

func NewHandler(auth *AuthManager, reg *registry.Registry, eb *eventbus.EventBus, enabled bool) *Handler {
	return &Handler{
		auth:     auth,
		registry: reg,
		eventBus: eb,
		enabled:  enabled,
	}
}

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	if !h.enabled {
		return
	}

	mux.HandleFunc("GET /web", h.handleIndex)
	mux.HandleFunc("GET /web/login", h.handleLoginPage)
	mux.HandleFunc("POST /web/login", h.handleLogin)
	mux.HandleFunc("POST /web/logout", h.handleLogout)
	mux.HandleFunc("POST /web/chat", h.handleChat)
	mux.HandleFunc("GET /web/status", h.handleStatus)
	mux.HandleFunc("GET /web/config", h.handleConfigDownload)
}

func (h *Handler) requireAuth(w http.ResponseWriter, r *http.Request) *Session {
	session := h.auth.GetSessionFromRequest(r)
	if session == nil {
		http.Redirect(w, r, "/web/login", http.StatusSeeOther)
		return nil
	}
	return session
}

func (h *Handler) handleIndex(w http.ResponseWriter, r *http.Request) {
	session := h.requireAuth(w, r)
	if session == nil {
		return
	}

	tmpl := template.Must(template.New("index").Parse(indexHTML))
	tmpl.Execute(w, map[string]interface{}{
		"Username": session.Username,
	})
}

func (h *Handler) handleLoginPage(w http.ResponseWriter, r *http.Request) {
	if h.auth.GetSessionFromRequest(r) != nil {
		http.Redirect(w, r, "/web", http.StatusSeeOther)
		return
	}

	tmpl := template.Must(template.New("login").Parse(loginHTML))
	tmpl.Execute(w, nil)
}

func (h *Handler) handleLogin(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		http.Error(w, "Invalid form", http.StatusBadRequest)
		return
	}

	username := r.FormValue("username")
	password := r.FormValue("password")

	if !h.auth.Authenticate(username, password) {
		tmpl := template.Must(template.New("login").Parse(loginHTML))
		tmpl.Execute(w, map[string]interface{}{
			"Error": "Invalid username or password",
		})
		return
	}

	session, err := h.auth.CreateSession(username)
	if err != nil {
		http.Error(w, "Failed to create session", http.StatusInternalServerError)
		return
	}

	h.auth.SetSessionCookie(w, session)
	http.Redirect(w, r, "/web", http.StatusSeeOther)
}

func (h *Handler) handleLogout(w http.ResponseWriter, r *http.Request) {
	if session := h.auth.GetSessionFromRequest(r); session != nil {
		h.auth.InvalidateSession(session.Token)
	}
	h.auth.ClearSessionCookie(w)
	http.Redirect(w, r, "/web/login", http.StatusSeeOther)
}

func (h *Handler) handleChat(w http.ResponseWriter, r *http.Request) {
	session := h.auth.GetSessionFromRequest(r)
	if session == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		Message string `json:"message"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	event := &eventbus.Event{
		Platform:  types.PlatformGateway,
		EventType: "message",
		Data: map[string]interface{}{
			"text":         req.Message,
			"user":         session.Username,
			"source":       "webui",
			"response_url": "",
		},
	}

	ctx, cancel := context.WithTimeout(r.Context(), 25*time.Second)
	defer cancel()

	resp, err := h.eventBus.Publish(ctx, event)
	if err != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if resp != nil && resp.Body != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success":  true,
			"response": resp.Body["text"],
		})
	} else {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success":  true,
			"response": "Command sent. No response from RI.",
		})
	}
}

func (h *Handler) handleStatus(w http.ResponseWriter, r *http.Request) {
	session := h.auth.GetSessionFromRequest(r)
	if session == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	ris := h.registry.GetAll()
	status := make([]map[string]interface{}, len(ris))
	for i, ri := range ris {
		status[i] = map[string]interface{}{
			"id":        ri.ID,
			"state":     ri.State,
			"version":   ri.Version,
			"load":      ri.Load,
			"inflight":  ri.Inflight,
			"lastHB":    ri.LastHeartbeat.Format(time.RFC3339),
			"hasRemote": ri.RemoteConfig != nil,
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"ris":       status,
		"timestamp": time.Now().Format(time.RFC3339),
	})
}

func (h *Handler) handleConfigDownload(w http.ResponseWriter, r *http.Request) {
	session := h.auth.GetSessionFromRequest(r)
	if session == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	gatewayURL := r.Host
	scheme := "http"
	if r.TLS != nil {
		scheme = "https"
	}

	config := map[string]interface{}{
		"gateway": map[string]interface{}{
			"enabled": true,
			"url":     scheme + "://" + gatewayURL,
		},
		"webui": map[string]interface{}{
			"username": h.auth.username,
		},
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Content-Disposition", "attachment; filename=gateway-config.json")
	json.NewEncoder(w).Encode(config)
}

const loginHTML = `<!DOCTYPE html>
<html>
<head>
    <title>Gateway - Login</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #1a1a2e; 
            color: #eee;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .login-box {
            background: #16213e;
            padding: 40px;
            border-radius: 8px;
            width: 100%;
            max-width: 400px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        }
        h1 { text-align: center; margin-bottom: 30px; color: #0f4c75; }
        .form-group { margin-bottom: 20px; }
        label { display: block; margin-bottom: 8px; color: #bbe1fa; }
        input {
            width: 100%;
            padding: 12px;
            border: 1px solid #0f4c75;
            border-radius: 4px;
            background: #1a1a2e;
            color: #eee;
            font-size: 16px;
        }
        input:focus { outline: none; border-color: #3282b8; }
        button {
            width: 100%;
            padding: 14px;
            background: #0f4c75;
            color: #fff;
            border: none;
            border-radius: 4px;
            font-size: 16px;
            cursor: pointer;
            transition: background 0.2s;
        }
        button:hover { background: #3282b8; }
        .error { 
            color: #ff6b6b; 
            text-align: center; 
            margin-bottom: 20px;
            padding: 10px;
            background: rgba(255,107,107,0.1);
            border-radius: 4px;
        }
    </style>
</head>
<body>
    <div class="login-box">
        <h1>🚀 Gateway</h1>
        {{if .Error}}<div class="error">{{.Error}}</div>{{end}}
        <form method="POST" action="/web/login">
            <div class="form-group">
                <label for="username">Username</label>
                <input type="text" id="username" name="username" required autofocus>
            </div>
            <div class="form-group">
                <label for="password">Password</label>
                <input type="password" id="password" name="password" required>
            </div>
            <button type="submit">Login</button>
        </form>
    </div>
</body>
</html>`

const indexHTML = `<!DOCTYPE html>
<html>
<head>
    <title>Gateway - Bot Console</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #1a1a2e; 
            color: #eee;
            min-height: 100vh;
        }
        .header {
            background: #16213e;
            padding: 15px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #0f4c75;
        }
        .header h1 { font-size: 20px; color: #bbe1fa; }
        .header-right { display: flex; align-items: center; gap: 15px; }
        .user { color: #3282b8; }
        .btn {
            padding: 8px 16px;
            background: #0f4c75;
            color: #fff;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            text-decoration: none;
        }
        .btn:hover { background: #3282b8; }
        .btn-outline {
            background: transparent;
            border: 1px solid #0f4c75;
        }
        .container { 
            max-width: 1200px; 
            margin: 0 auto; 
            padding: 20px;
            display: grid;
            grid-template-columns: 1fr 300px;
            gap: 20px;
        }
        .chat-container {
            background: #16213e;
            border-radius: 8px;
            display: flex;
            flex-direction: column;
            height: calc(100vh - 120px);
        }
        .chat-messages {
            flex: 1;
            overflow-y: auto;
            padding: 20px;
        }
        .message {
            margin-bottom: 15px;
            padding: 12px 15px;
            border-radius: 8px;
            max-width: 80%;
        }
        .message.user {
            background: #0f4c75;
            margin-left: auto;
        }
        .message.bot {
            background: #1a1a2e;
            border: 1px solid #0f4c75;
        }
        .message .time {
            font-size: 11px;
            color: #666;
            margin-top: 5px;
        }
        .chat-input {
            padding: 15px;
            border-top: 1px solid #0f4c75;
            display: flex;
            gap: 10px;
        }
        .chat-input input {
            flex: 1;
            padding: 12px;
            border: 1px solid #0f4c75;
            border-radius: 4px;
            background: #1a1a2e;
            color: #eee;
            font-size: 14px;
        }
        .chat-input input:focus { outline: none; border-color: #3282b8; }
        .sidebar {
            display: flex;
            flex-direction: column;
            gap: 20px;
        }
        .panel {
            background: #16213e;
            border-radius: 8px;
            padding: 15px;
        }
        .panel h3 { 
            margin-bottom: 15px; 
            color: #bbe1fa;
            font-size: 14px;
            text-transform: uppercase;
        }
        .ri-item {
            padding: 10px;
            background: #1a1a2e;
            border-radius: 4px;
            margin-bottom: 8px;
        }
        .ri-item .name { font-weight: bold; }
        .ri-item .status {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 11px;
            margin-left: 8px;
        }
        .ri-item .status.ONLINE { background: #27ae60; }
        .ri-item .status.REGISTERED { background: #3282b8; }
        .ri-item .status.STALE { background: #f39c12; }
        .ri-item .status.OFFLINE { background: #e74c3c; }
        .ri-item .info { font-size: 12px; color: #666; margin-top: 5px; }
        .commands {
            font-size: 13px;
            line-height: 1.8;
        }
        .commands code {
            background: #1a1a2e;
            padding: 2px 6px;
            border-radius: 3px;
            color: #3282b8;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🚀 Gateway Bot Console</h1>
        <div class="header-right">
            <span class="user">👤 {{.Username}}</span>
            <a href="/web/config" class="btn btn-outline">📥 Config</a>
            <form action="/web/logout" method="POST" style="display:inline">
                <button type="submit" class="btn btn-outline">Logout</button>
            </form>
        </div>
    </div>
    <div class="container">
        <div class="chat-container">
            <div class="chat-messages" id="messages"></div>
            <div class="chat-input">
                <input type="text" id="messageInput" placeholder="Type a command (e.g., /help, /ai hello)..." autofocus>
                <button class="btn" onclick="sendMessage()">Send</button>
            </div>
        </div>
        <div class="sidebar">
            <div class="panel">
                <h3>Connected RIs</h3>
                <div id="riList">Loading...</div>
            </div>
            <div class="panel">
                <h3>Commands</h3>
                <div class="commands">
                    <code>/help</code> - Show commands<br>
                    <code>/ai &lt;prompt&gt;</code> - Send to AI<br>
                    <code>/sessions</code> - List sessions<br>
                    <code>/select &lt;n&gt;</code> - Switch session<br>
                    <code>/status</code> - Show status<br>
                    <code>/stop</code> - Send Ctrl+C<br>
                    <code>/y</code> / <code>/n</code> - Confirm
                </div>
            </div>
        </div>
    </div>
    <script>
        const messagesEl = document.getElementById('messages');
        const inputEl = document.getElementById('messageInput');
        
        function addMessage(text, isUser) {
            const div = document.createElement('div');
            div.className = 'message ' + (isUser ? 'user' : 'bot');
            div.innerHTML = text.replace(/\n/g, '<br>') + 
                '<div class="time">' + new Date().toLocaleTimeString() + '</div>';
            messagesEl.appendChild(div);
            messagesEl.scrollTop = messagesEl.scrollHeight;
        }
        
        async function sendMessage() {
            const msg = inputEl.value.trim();
            if (!msg) return;
            
            addMessage(msg, true);
            inputEl.value = '';
            
            try {
                const resp = await fetch('/web/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: msg })
                });
                const data = await resp.json();
                if (data.success) {
                    addMessage(data.response || 'No response', false);
                } else {
                    addMessage('Error: ' + data.error, false);
                }
            } catch (err) {
                addMessage('Error: ' + err.message, false);
            }
        }
        
        inputEl.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
        
        async function loadStatus() {
            try {
                const resp = await fetch('/web/status');
                const data = await resp.json();
                const listEl = document.getElementById('riList');
                
                if (data.ris.length === 0) {
                    listEl.innerHTML = '<div style="color:#666">No RIs connected</div>';
                    return;
                }
                
                listEl.innerHTML = data.ris.map(ri => 
                    '<div class="ri-item">' +
                    '<span class="name">' + ri.id + '</span>' +
                    '<span class="status ' + ri.state + '">' + ri.state + '</span>' +
                    '<div class="info">v' + ri.version + ' | Load: ' + (ri.load * 100).toFixed(0) + '% | In-flight: ' + ri.inflight + '</div>' +
                    '</div>'
                ).join('');
            } catch (err) {
                console.error('Failed to load status:', err);
            }
        }
        
        loadStatus();
        setInterval(loadStatus, 5000);
        
        addMessage('Welcome to Gateway Bot Console! Type /help to see available commands.', false);
    </script>
</body>
</html>`
