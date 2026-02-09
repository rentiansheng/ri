// Package bot provides a built-in bot that can handle events like a Slack App.
package bot

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"sync"

	"om/gateway/internal/types"
	"om/gateway/pkg/riclient"
)

const discordEphemeralFlag = 64

type CommandHandler func(ctx context.Context, cmd *Command) (*Response, error)

type Command struct {
	Name      string
	Args      []string
	RawText   string
	Platform  types.Platform
	SessionID string
	UserID    string
	ChannelID string
	Data      map[string]interface{}
}

type Response struct {
	Text        string
	Attachments []Attachment
	Ephemeral   bool
}

type Attachment struct {
	Title    string
	Text     string
	Color    string
	ImageURL string
	Fields   []AttachmentField
}

type AttachmentField struct {
	Title string
	Value string
	Short bool
}

type Bot struct {
	client   *riclient.Client
	config   Config
	commands map[string]CommandHandler
	cmdMu    sync.RWMutex

	defaultHandler CommandHandler
	middleware     []Middleware
}

type Middleware func(next CommandHandler) CommandHandler

type Config struct {
	RIClient      riclient.Config
	CommandPrefix string
	BotName       string
}

func DefaultConfig() Config {
	return Config{
		RIClient:      riclient.DefaultConfig(),
		CommandPrefix: "/",
		BotName:       "ri-bot",
	}
}

func New(cfg Config) *Bot {
	if cfg.RIClient.RIID == "" {
		cfg.RIClient.RIID = cfg.BotName
	}
	if cfg.CommandPrefix == "" {
		cfg.CommandPrefix = "/"
	}

	b := &Bot{
		config:   cfg,
		commands: make(map[string]CommandHandler),
	}

	b.client = riclient.New(cfg.RIClient)
	b.client.SetHandler(b.handleEvent)

	return b
}

func (b *Bot) RegisterCommand(name string, handler CommandHandler) {
	b.cmdMu.Lock()
	defer b.cmdMu.Unlock()
	b.commands[strings.ToLower(name)] = handler
}

func (b *Bot) SetDefaultHandler(handler CommandHandler) {
	b.defaultHandler = handler
}

func (b *Bot) Use(mw Middleware) {
	b.middleware = append(b.middleware, mw)
}

func (b *Bot) Start(ctx context.Context) error {
	b.client.OnStateChange = func(old, new riclient.ClientState) {
		log.Printf("[Bot] State changed: %s -> %s", old, new)
	}
	b.client.OnError = func(err error) {
		log.Printf("[Bot] Error: %v", err)
	}

	log.Printf("[Bot] Starting bot '%s' with prefix '%s'", b.config.BotName, b.config.CommandPrefix)
	return b.client.Start(ctx)
}

func (b *Bot) Stop() {
	b.client.Stop()
	log.Printf("[Bot] Stopped")
}

func (b *Bot) Client() *riclient.Client {
	return b.client
}

func (b *Bot) handleEvent(ctx context.Context, env *types.Envelope) (*types.ResponsePayload, error) {
	if env.Type != types.MessageTypeEvent {
		return nil, nil
	}

	var event types.EventPayload
	if err := json.Unmarshal(env.Payload, &event); err != nil {
		return nil, fmt.Errorf("failed to unmarshal event: %w", err)
	}

	cmd := b.parseCommand(&event)
	if cmd == nil {
		return nil, nil
	}

	resp, err := b.executeCommand(ctx, cmd)
	if err != nil {
		return b.formatErrorResponse(&event, err), nil
	}

	if resp == nil {
		return nil, nil
	}

	return b.formatResponse(&event, resp), nil
}

func (b *Bot) parseCommand(event *types.EventPayload) *Command {
	text, _ := event.Data["text"].(string)
	if text == "" {
		return nil
	}

	text = strings.TrimSpace(text)

	if !strings.HasPrefix(text, b.config.CommandPrefix) {
		if b.defaultHandler != nil {
			return &Command{
				Name:      "",
				RawText:   text,
				Platform:  event.Platform,
				SessionID: event.SessionID,
				UserID:    getString(event.Data, "user_id"),
				ChannelID: getString(event.Data, "channel_id"),
				Data:      event.Data,
			}
		}
		return nil
	}

	text = strings.TrimPrefix(text, b.config.CommandPrefix)
	parts := strings.Fields(text)
	if len(parts) == 0 {
		return nil
	}

	return &Command{
		Name:      strings.ToLower(parts[0]),
		Args:      parts[1:],
		RawText:   text,
		Platform:  event.Platform,
		SessionID: event.SessionID,
		UserID:    getString(event.Data, "user_id"),
		ChannelID: getString(event.Data, "channel_id"),
		Data:      event.Data,
	}
}

func (b *Bot) executeCommand(ctx context.Context, cmd *Command) (*Response, error) {
	var handler CommandHandler

	if cmd.Name == "" {
		handler = b.defaultHandler
	} else {
		b.cmdMu.RLock()
		handler = b.commands[cmd.Name]
		b.cmdMu.RUnlock()
	}

	if handler == nil {
		return &Response{
			Text: fmt.Sprintf("Unknown command: %s%s", b.config.CommandPrefix, cmd.Name),
		}, nil
	}

	for i := len(b.middleware) - 1; i >= 0; i-- {
		handler = b.middleware[i](handler)
	}

	return handler(ctx, cmd)
}

func (b *Bot) formatResponse(event *types.EventPayload, resp *Response) *types.ResponsePayload {
	body := make(map[string]interface{})

	switch event.Platform {
	case types.PlatformSlack:
		body["text"] = resp.Text
		if resp.Ephemeral {
			body["response_type"] = "ephemeral"
		} else {
			body["response_type"] = "in_channel"
		}
		if len(resp.Attachments) > 0 {
			body["attachments"] = b.formatSlackAttachments(resp.Attachments)
		}

	case types.PlatformDiscord:
		body["content"] = resp.Text
		if len(resp.Attachments) > 0 {
			body["embeds"] = b.formatDiscordEmbeds(resp.Attachments)
		}
		if resp.Ephemeral {
			body["flags"] = discordEphemeralFlag
		}
	}

	return &types.ResponsePayload{
		Platform:    event.Platform,
		ResponseURL: getString(event.Data, "response_url"),
		Body:        body,
	}
}

func (b *Bot) formatErrorResponse(event *types.EventPayload, err error) *types.ResponsePayload {
	return b.formatResponse(event, &Response{
		Text:      fmt.Sprintf("Error: %v", err),
		Ephemeral: true,
	})
}

func (b *Bot) formatSlackAttachments(attachments []Attachment) []map[string]interface{} {
	result := make([]map[string]interface{}, len(attachments))
	for i, att := range attachments {
		a := map[string]interface{}{
			"title": att.Title,
			"text":  att.Text,
		}
		if att.Color != "" {
			a["color"] = att.Color
		}
		if att.ImageURL != "" {
			a["image_url"] = att.ImageURL
		}
		if len(att.Fields) > 0 {
			fields := make([]map[string]interface{}, len(att.Fields))
			for j, f := range att.Fields {
				fields[j] = map[string]interface{}{
					"title": f.Title,
					"value": f.Value,
					"short": f.Short,
				}
			}
			a["fields"] = fields
		}
		result[i] = a
	}
	return result
}

func (b *Bot) formatDiscordEmbeds(attachments []Attachment) []map[string]interface{} {
	result := make([]map[string]interface{}, len(attachments))
	for i, att := range attachments {
		e := map[string]interface{}{
			"title":       att.Title,
			"description": att.Text,
		}
		if att.Color != "" {
			e["color"] = parseColor(att.Color)
		}
		if att.ImageURL != "" {
			e["image"] = map[string]string{"url": att.ImageURL}
		}
		if len(att.Fields) > 0 {
			fields := make([]map[string]interface{}, len(att.Fields))
			for j, f := range att.Fields {
				fields[j] = map[string]interface{}{
					"name":   f.Title,
					"value":  f.Value,
					"inline": f.Short,
				}
			}
			e["fields"] = fields
		}
		result[i] = e
	}
	return result
}

func getString(data map[string]interface{}, key string) string {
	if v, ok := data[key].(string); ok {
		return v
	}
	return ""
}

func parseColor(color string) int {
	color = strings.TrimPrefix(color, "#")
	var c int
	fmt.Sscanf(color, "%x", &c)
	return c
}
