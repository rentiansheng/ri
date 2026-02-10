package bot

import (
	"context"
	"encoding/json"
	"testing"

	"om/gateway/internal/types"
)

func TestBot_ParseCommand(t *testing.T) {
	cfg := DefaultConfig()
	cfg.CommandPrefix = "/"
	b := New(cfg)

	tests := []struct {
		name     string
		text     string
		wantCmd  string
		wantArgs []string
		wantNil  bool
	}{
		{
			name:    "simple command",
			text:    "/ping",
			wantCmd: "ping",
		},
		{
			name:     "command with args",
			text:     "/echo hello world",
			wantCmd:  "echo",
			wantArgs: []string{"hello", "world"},
		},
		{
			name:    "no prefix - no default handler",
			text:    "hello",
			wantNil: true,
		},
		{
			name:    "empty text",
			text:    "",
			wantNil: true,
		},
		{
			name:    "only prefix",
			text:    "/",
			wantNil: true,
		},
		{
			name:    "uppercase command",
			text:    "/PING",
			wantCmd: "ping",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			event := &types.EventPayload{
				SessionID: "test-session",
				Platform:  types.PlatformSlack,
				EventType: "message",
				Data: map[string]interface{}{
					"text":       tt.text,
					"user_id":    "U123",
					"channel_id": "C456",
				},
			}

			cmd := b.parseCommand(event)

			if tt.wantNil {
				if cmd != nil {
					t.Errorf("expected nil command, got %+v", cmd)
				}
				return
			}

			if cmd == nil {
				t.Fatal("expected command, got nil")
			}

			if cmd.Name != tt.wantCmd {
				t.Errorf("Name = %q, want %q", cmd.Name, tt.wantCmd)
			}

			if len(tt.wantArgs) > 0 {
				if len(cmd.Args) != len(tt.wantArgs) {
					t.Errorf("Args length = %d, want %d", len(cmd.Args), len(tt.wantArgs))
				}
				for i, arg := range tt.wantArgs {
					if i < len(cmd.Args) && cmd.Args[i] != arg {
						t.Errorf("Args[%d] = %q, want %q", i, cmd.Args[i], arg)
					}
				}
			}
		})
	}
}

func TestBot_ExecuteCommand(t *testing.T) {
	cfg := DefaultConfig()
	b := New(cfg)

	called := false
	b.RegisterCommand("test", func(ctx context.Context, cmd *Command) (*Response, error) {
		called = true
		return &Response{Text: "test response"}, nil
	})

	cmd := &Command{Name: "test"}
	resp, err := b.executeCommand(context.Background(), cmd)

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !called {
		t.Error("handler was not called")
	}
	if resp.Text != "test response" {
		t.Errorf("Text = %q, want %q", resp.Text, "test response")
	}
}

func TestBot_ExecuteUnknownCommand(t *testing.T) {
	cfg := DefaultConfig()
	b := New(cfg)

	cmd := &Command{Name: "unknown"}
	resp, err := b.executeCommand(context.Background(), cmd)

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp == nil {
		t.Fatal("expected response, got nil")
	}
	if resp.Text == "" {
		t.Error("expected error message in response")
	}
}

func TestBot_Middleware(t *testing.T) {
	cfg := DefaultConfig()
	b := New(cfg)

	order := []string{}

	b.Use(func(next CommandHandler) CommandHandler {
		return func(ctx context.Context, cmd *Command) (*Response, error) {
			order = append(order, "mw1-before")
			resp, err := next(ctx, cmd)
			order = append(order, "mw1-after")
			return resp, err
		}
	})

	b.Use(func(next CommandHandler) CommandHandler {
		return func(ctx context.Context, cmd *Command) (*Response, error) {
			order = append(order, "mw2-before")
			resp, err := next(ctx, cmd)
			order = append(order, "mw2-after")
			return resp, err
		}
	})

	b.RegisterCommand("test", func(ctx context.Context, cmd *Command) (*Response, error) {
		order = append(order, "handler")
		return &Response{Text: "ok"}, nil
	})

	cmd := &Command{Name: "test"}
	b.executeCommand(context.Background(), cmd)

	expected := []string{"mw1-before", "mw2-before", "handler", "mw2-after", "mw1-after"}
	if len(order) != len(expected) {
		t.Fatalf("order length = %d, want %d", len(order), len(expected))
	}
	for i, v := range expected {
		if order[i] != v {
			t.Errorf("order[%d] = %q, want %q", i, order[i], v)
		}
	}
}

func TestBot_FormatSlackResponse(t *testing.T) {
	cfg := DefaultConfig()
	b := New(cfg)

	event := &types.EventPayload{
		Platform: types.PlatformSlack,
		Data:     map[string]interface{}{"response_url": "https://slack.com/response"},
	}

	resp := &Response{
		Text:      "Hello",
		Ephemeral: true,
		Attachments: []Attachment{
			{Title: "Test", Text: "Description", Color: "#ff0000"},
		},
	}

	payload := b.formatResponse(event, resp)

	if payload.Platform != types.PlatformSlack {
		t.Errorf("Platform = %v, want %v", payload.Platform, types.PlatformSlack)
	}
	if payload.ResponseURL != "https://slack.com/response" {
		t.Errorf("ResponseURL = %q, want %q", payload.ResponseURL, "https://slack.com/response")
	}
	if payload.Body["text"] != "Hello" {
		t.Errorf("text = %v, want %v", payload.Body["text"], "Hello")
	}
	if payload.Body["response_type"] != "ephemeral" {
		t.Errorf("response_type = %v, want %v", payload.Body["response_type"], "ephemeral")
	}
}

func TestBot_FormatDiscordResponse(t *testing.T) {
	cfg := DefaultConfig()
	b := New(cfg)

	event := &types.EventPayload{
		Platform: types.PlatformDiscord,
		Data:     map[string]interface{}{},
	}

	resp := &Response{
		Text:      "Hello Discord",
		Ephemeral: true,
	}

	payload := b.formatResponse(event, resp)

	if payload.Platform != types.PlatformDiscord {
		t.Errorf("Platform = %v, want %v", payload.Platform, types.PlatformDiscord)
	}
	if payload.Body["content"] != "Hello Discord" {
		t.Errorf("content = %v, want %v", payload.Body["content"], "Hello Discord")
	}
	if payload.Body["flags"] != discordEphemeralFlag {
		t.Errorf("flags = %v, want %v", payload.Body["flags"], discordEphemeralFlag)
	}
}

func TestBot_HandleEvent(t *testing.T) {
	cfg := DefaultConfig()
	b := New(cfg)

	b.RegisterCommand("test", func(ctx context.Context, cmd *Command) (*Response, error) {
		return &Response{Text: "handled"}, nil
	})

	eventPayload := types.EventPayload{
		SessionID: "test-session",
		Platform:  types.PlatformSlack,
		EventType: "message",
		Data: map[string]interface{}{
			"text":       "/test",
			"user_id":    "U123",
			"channel_id": "C456",
		},
	}

	payloadBytes, _ := json.Marshal(eventPayload)
	env := &types.Envelope{
		Type:    types.MessageTypeEvent,
		ID:      "evt-123",
		Payload: payloadBytes,
	}

	resp, err := b.handleEvent(context.Background(), env)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp == nil {
		t.Fatal("expected response, got nil")
	}
	if resp.Body["text"] != "handled" {
		t.Errorf("text = %v, want %v", resp.Body["text"], "handled")
	}
}

func TestBuiltinCommands(t *testing.T) {
	cfg := DefaultConfig()
	b := New(cfg)
	RegisterBuiltinCommands(b)

	tests := []struct {
		name    string
		cmdName string
		args    []string
	}{
		{"help", "help", nil},
		{"ping", "ping", nil},
		{"echo", "echo", []string{"hello"}},
		{"status", "status", nil},
		{"time", "time", nil},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cmd := &Command{
				Name:     tt.cmdName,
				Args:     tt.args,
				Platform: types.PlatformSlack,
			}
			resp, err := b.executeCommand(context.Background(), cmd)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if resp == nil {
				t.Fatal("expected response, got nil")
			}
		})
	}
}
