package config

import (
	"encoding/json"
	"os"
	"time"
)

type Config struct {
	Server   ServerConfig   `json:"server"`
	Slack    SlackConfig    `json:"slack"`
	Discord  DiscordConfig  `json:"discord"`
	Registry RegistryConfig `json:"registry"`
	Security SecurityConfig `json:"security"`
	WebUI    WebUIConfig    `json:"web_ui"`
}

type ServerConfig struct {
	Addr        string        `json:"addr"`
	PollTimeout time.Duration `json:"poll_timeout"`
}

type SlackConfig struct {
	SigningSecret string `json:"signing_secret"`
}

type DiscordConfig struct {
	PublicKey string `json:"public_key"`
}

type RegistryConfig struct {
	HeartbeatInterval time.Duration `json:"heartbeat_interval"`
	HeartbeatTimeout  time.Duration `json:"heartbeat_timeout"`
	StaleTimeout      time.Duration `json:"stale_timeout"`
}

type SecurityConfig struct {
	EncryptionKey string `json:"encryption_key"`
}

type WebUIConfig struct {
	Enabled  bool   `json:"enabled"`
	Username string `json:"username"`
	Password string `json:"password"`
}

func LoadFromFile(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var cfg Config
	if err := json.Unmarshal(data, &cfg); err != nil {
		return nil, err
	}

	return &cfg, nil
}

func LoadFromEnv() *Config {
	return &Config{
		Server: ServerConfig{
			Addr:        getEnv("GATEWAY_ADDR", ":8080"),
			PollTimeout: getDurationEnv("GATEWAY_POLL_TIMEOUT", 30*time.Second),
		},
		Slack: SlackConfig{
			SigningSecret: os.Getenv("SLACK_SIGNING_SECRET"),
		},
		Discord: DiscordConfig{
			PublicKey: os.Getenv("DISCORD_PUBLIC_KEY"),
		},
		Registry: RegistryConfig{
			HeartbeatInterval: getDurationEnv("REGISTRY_HEARTBEAT_INTERVAL", 10*time.Second),
			HeartbeatTimeout:  getDurationEnv("REGISTRY_HEARTBEAT_TIMEOUT", 25*time.Second),
			StaleTimeout:      getDurationEnv("REGISTRY_STALE_TIMEOUT", 60*time.Second),
		},
		Security: SecurityConfig{
			EncryptionKey: os.Getenv("GATEWAY_ENCRYPTION_KEY"),
		},
		WebUI: WebUIConfig{
			Enabled:  os.Getenv("GATEWAY_WEBUI_ENABLED") == "true",
			Username: getEnv("GATEWAY_WEBUI_USERNAME", "admin"),
			Password: os.Getenv("GATEWAY_WEBUI_PASSWORD"),
		},
	}
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}

func getDurationEnv(key string, defaultVal time.Duration) time.Duration {
	if val := os.Getenv(key); val != "" {
		if d, err := time.ParseDuration(val); err == nil {
			return d
		}
	}
	return defaultVal
}
