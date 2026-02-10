package webui

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"net/http"
	"sync"
	"time"
)

const (
	SessionCookieName = "gateway_session"
	SessionDuration   = 24 * time.Hour
)

type Session struct {
	Token     string
	Username  string
	ExpiresAt time.Time
}

type AuthManager struct {
	username string
	password string
	sessions map[string]*Session
	mu       sync.RWMutex
}

func NewAuthManager(username, password string) *AuthManager {
	return &AuthManager{
		username: username,
		password: password,
		sessions: make(map[string]*Session),
	}
}

func (a *AuthManager) Authenticate(username, password string) bool {
	return subtle.ConstantTimeCompare([]byte(a.username), []byte(username)) == 1 &&
		subtle.ConstantTimeCompare([]byte(a.password), []byte(password)) == 1
}

func (a *AuthManager) CreateSession(username string) (*Session, error) {
	tokenBytes := make([]byte, 32)
	if _, err := rand.Read(tokenBytes); err != nil {
		return nil, err
	}

	token := base64.URLEncoding.EncodeToString(tokenBytes)
	session := &Session{
		Token:     token,
		Username:  username,
		ExpiresAt: time.Now().Add(SessionDuration),
	}

	a.mu.Lock()
	a.sessions[token] = session
	a.mu.Unlock()

	return session, nil
}

func (a *AuthManager) ValidateSession(token string) *Session {
	a.mu.RLock()
	session, exists := a.sessions[token]
	a.mu.RUnlock()

	if !exists {
		return nil
	}

	if time.Now().After(session.ExpiresAt) {
		a.mu.Lock()
		delete(a.sessions, token)
		a.mu.Unlock()
		return nil
	}

	return session
}

func (a *AuthManager) InvalidateSession(token string) {
	a.mu.Lock()
	delete(a.sessions, token)
	a.mu.Unlock()
}

func (a *AuthManager) GetSessionFromRequest(r *http.Request) *Session {
	cookie, err := r.Cookie(SessionCookieName)
	if err != nil {
		return nil
	}
	return a.ValidateSession(cookie.Value)
}

func (a *AuthManager) SetSessionCookie(w http.ResponseWriter, session *Session) {
	http.SetCookie(w, &http.Cookie{
		Name:     SessionCookieName,
		Value:    session.Token,
		Path:     "/",
		HttpOnly: true,
		Secure:   false,
		SameSite: http.SameSiteLaxMode,
		Expires:  session.ExpiresAt,
	})
}

func (a *AuthManager) ClearSessionCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     SessionCookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		MaxAge:   -1,
	})
}

func (a *AuthManager) CleanExpiredSessions() {
	a.mu.Lock()
	defer a.mu.Unlock()

	now := time.Now()
	for token, session := range a.sessions {
		if now.After(session.ExpiresAt) {
			delete(a.sessions, token)
		}
	}
}
