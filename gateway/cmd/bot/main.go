package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"

	"om/gateway/pkg/bot"
	"om/gateway/pkg/riclient"
)

func main() {
	var (
		gatewayURL  = flag.String("gateway", "http://localhost:8080", "Gateway URL")
		botID       = flag.String("id", "ri-bot", "Bot ID")
		botName     = flag.String("name", "RI Bot", "Bot display name")
		prefix      = flag.String("prefix", "/", "Command prefix")
		interactive = flag.Bool("interactive", false, "Enable interactive mode for testing")
	)
	flag.Parse()

	cfg := bot.Config{
		RIClient: riclient.Config{
			GatewayURL:     *gatewayURL,
			RIID:           *botID,
			Version:        "1.0.0",
			Capabilities:   []string{"chat", "command", "bot"},
			MaxConcurrency: 10,
		},
		CommandPrefix: *prefix,
		BotName:       *botName,
	}

	b := bot.New(cfg)
	bot.RegisterBuiltinCommands(b)

	registerCustomCommands(b)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	if err := b.Start(ctx); err != nil {
		log.Fatalf("Failed to start bot: %v", err)
	}

	log.Printf("Bot '%s' started, connected to %s", *botName, *gatewayURL)
	log.Printf("Command prefix: %s", *prefix)
	log.Printf("Available commands: help, ping, echo, status, time")

	if *interactive {
		go runInteractiveMode(b, *gatewayURL)
	}

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	<-sigCh

	log.Println("Shutting down...")
	b.Stop()
}

func registerCustomCommands(b *bot.Bot) {
	b.RegisterCommand("hello", func(ctx context.Context, cmd *bot.Command) (*bot.Response, error) {
		name := "there"
		if len(cmd.Args) > 0 {
			name = cmd.Args[0]
		}
		return &bot.Response{
			Text: fmt.Sprintf("Hello, %s! 👋", name),
		}, nil
	})

	b.RegisterCommand("info", func(ctx context.Context, cmd *bot.Command) (*bot.Response, error) {
		return &bot.Response{
			Attachments: []bot.Attachment{
				{
					Title: "RI Bot Information",
					Text:  "A built-in bot for Gateway that handles Slack/Discord-like commands.",
					Color: "#0066cc",
					Fields: []bot.AttachmentField{
						{Title: "Platform", Value: string(cmd.Platform), Short: true},
						{Title: "Channel", Value: cmd.ChannelID, Short: true},
						{Title: "User", Value: cmd.UserID, Short: true},
						{Title: "Session", Value: cmd.SessionID, Short: true},
					},
				},
			},
		}, nil
	})
}

func runInteractiveMode(b *bot.Bot, gatewayURL string) {
	mock := bot.NewMockClient(gatewayURL)

	log.Println("\n=== Interactive Mode ===")
	log.Println("Type messages to send as mock Slack events")
	log.Println("Commands:")
	log.Println("  /health  - Check gateway health")
	log.Println("  /list    - List connected RIs")
	log.Println("  /quit    - Exit interactive mode")
	log.Println("========================")

	var input string
	for {
		fmt.Print("> ")
		if _, err := fmt.Scanln(&input); err != nil {
			continue
		}

		switch input {
		case "/health":
			health, err := mock.GetHealth()
			if err != nil {
				log.Printf("Error: %v", err)
				continue
			}
			log.Printf("Health: status=%s, ri_count=%d, inflight=%d",
				health.Status, health.RICount, health.Inflight)

		case "/list":
			ris, err := mock.ListRIs()
			if err != nil {
				log.Printf("Error: %v", err)
				continue
			}
			if len(ris) == 0 {
				log.Println("No RIs connected")
				continue
			}
			for _, ri := range ris {
				log.Printf("RI: id=%s, state=%s, load=%.2f", ri.ID, ri.State, ri.Load)
			}

		case "/quit":
			log.Println("Exiting interactive mode")
			return

		default:
			resp, err := mock.SendGatewayMessage("test-channel", "test-user", input)
			if err != nil {
				log.Printf("Error: %v", err)
				continue
			}
			if resp.StatusCode != 200 {
				log.Printf("Error: status=%d, body=%s", resp.StatusCode, resp.Body)
				continue
			}
			log.Printf("Response: %s", resp.Body)
		}
	}
}
