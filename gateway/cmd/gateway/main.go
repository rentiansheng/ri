package main

import (
	"context"
	"flag"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"om/gateway/internal/adapter"
	"om/gateway/internal/config"
	"om/gateway/internal/connection"
	"om/gateway/internal/eventbus"
	"om/gateway/internal/registry"
	"om/gateway/internal/server"
)

func main() {
	configFile := flag.String("config", "", "path to config file")
	flag.Parse()

	var cfg *config.Config
	if *configFile != "" {
		var err error
		cfg, err = config.LoadFromFile(*configFile)
		if err != nil {
			log.Fatalf("failed to load config: %v", err)
		}
	} else {
		cfg = config.LoadFromEnv()
	}

	connMgr := connection.NewConnectionManager()
	reg := registry.New(connMgr)
	eb := eventbus.New(reg, connMgr)

	adapters := adapter.NewAdapterRegistry()
	adapters.Register(adapter.NewSlackAdapter(cfg.Slack.SigningSecret))
	adapters.Register(adapter.NewDiscordAdapter(cfg.Discord.PublicKey))
	adapters.Register(adapter.NewGatewayAdapter())

	srv := server.New(server.Config{
		Addr:        cfg.Server.Addr,
		PollTimeout: cfg.Server.PollTimeout,
	}, reg, connMgr, eb, adapters)

	reg.StartHealthCheck()

	go func() {
		if err := srv.Start(); err != nil {
			log.Printf("server error: %v", err)
		}
	}()

	log.Printf("Gateway started on %s", cfg.Server.Addr)

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	<-sigCh

	log.Println("Shutting down...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	reg.Stop()
	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("shutdown error: %v", err)
	}

	log.Println("Gateway stopped")
}
