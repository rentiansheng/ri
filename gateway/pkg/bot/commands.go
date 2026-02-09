package bot

import (
	"context"
	"fmt"
	"runtime"
	"strings"
	"time"
)

func RegisterBuiltinCommands(b *Bot) {
	b.RegisterCommand("help", helpCommand(b))
	b.RegisterCommand("ping", pingCommand())
	b.RegisterCommand("echo", echoCommand())
	b.RegisterCommand("status", statusCommand(b))
	b.RegisterCommand("time", timeCommand())
}

func helpCommand(b *Bot) CommandHandler {
	return func(ctx context.Context, cmd *Command) (*Response, error) {
		b.cmdMu.RLock()
		commands := make([]string, 0, len(b.commands))
		for name := range b.commands {
			commands = append(commands, b.config.CommandPrefix+name)
		}
		b.cmdMu.RUnlock()

		return &Response{
			Text: fmt.Sprintf("Available commands:\n%s", strings.Join(commands, "\n")),
		}, nil
	}
}

func pingCommand() CommandHandler {
	return func(ctx context.Context, cmd *Command) (*Response, error) {
		return &Response{Text: "pong! 🏓"}, nil
	}
}

func echoCommand() CommandHandler {
	return func(ctx context.Context, cmd *Command) (*Response, error) {
		if len(cmd.Args) == 0 {
			return &Response{Text: "Usage: /echo <message>"}, nil
		}
		return &Response{Text: strings.Join(cmd.Args, " ")}, nil
	}
}

func statusCommand(b *Bot) CommandHandler {
	return func(ctx context.Context, cmd *Command) (*Response, error) {
		client := b.Client()
		return &Response{
			Attachments: []Attachment{
				{
					Title: "Bot Status",
					Color: "#36a64f",
					Fields: []AttachmentField{
						{Title: "State", Value: string(client.State()), Short: true},
						{Title: "Inflight", Value: fmt.Sprintf("%d", client.Inflight()), Short: true},
						{Title: "Go Version", Value: runtime.Version(), Short: true},
						{Title: "Platform", Value: string(cmd.Platform), Short: true},
					},
				},
			},
		}, nil
	}
}

func timeCommand() CommandHandler {
	return func(ctx context.Context, cmd *Command) (*Response, error) {
		now := time.Now()
		return &Response{
			Text: fmt.Sprintf("Current time: %s (Unix: %d)", now.Format(time.RFC3339), now.Unix()),
		}, nil
	}
}
