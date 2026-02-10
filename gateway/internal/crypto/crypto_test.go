package crypto

import (
	"encoding/json"
	"testing"
)

func TestEncryptDecrypt(t *testing.T) {
	key := "test-secret-key-12345"
	plaintext := []byte(`{"discord":{"enabled":true,"token":"xoxb-123"},"slack":{"enabled":false}}`)

	encrypted, err := Encrypt(plaintext, key)
	if err != nil {
		t.Fatalf("Encrypt failed: %v", err)
	}

	if !encrypted.Encrypted {
		t.Fatal("Expected encrypted=true")
	}

	if encrypted.IV == "" {
		t.Fatal("Expected IV to be set")
	}

	if encrypted.AuthTag == "" {
		t.Fatal("Expected AuthTag to be set")
	}

	decrypted, err := Decrypt(encrypted, key)
	if err != nil {
		t.Fatalf("Decrypt failed: %v", err)
	}

	if string(decrypted) != string(plaintext) {
		t.Fatalf("Decrypted text doesn't match: got %s, want %s", decrypted, plaintext)
	}
}

func TestDecryptJSON(t *testing.T) {
	key := "test-secret-key-12345"

	type TestConfig struct {
		Discord struct {
			Enabled bool   `json:"enabled"`
			Token   string `json:"token"`
		} `json:"discord"`
	}

	original := TestConfig{}
	original.Discord.Enabled = true
	original.Discord.Token = "test-token"

	encrypted, err := EncryptJSON(original, key)
	if err != nil {
		t.Fatalf("EncryptJSON failed: %v", err)
	}

	var decrypted TestConfig
	if err := DecryptJSON(encrypted, key, &decrypted); err != nil {
		t.Fatalf("DecryptJSON failed: %v", err)
	}

	if decrypted.Discord.Enabled != original.Discord.Enabled {
		t.Fatalf("Discord.Enabled mismatch: got %v, want %v", decrypted.Discord.Enabled, original.Discord.Enabled)
	}

	if decrypted.Discord.Token != original.Discord.Token {
		t.Fatalf("Discord.Token mismatch: got %s, want %s", decrypted.Discord.Token, original.Discord.Token)
	}
}

func TestDecryptNodeJSPayload(t *testing.T) {
	nodeJSPayload := `{
		"encrypted": true,
		"iv": "dGVzdGl2MTIzNDU2",
		"authTag": "dGVzdGF1dGh0YWcxMjM0NQ==",
		"data": "dGVzdGVuY3J5cHRlZGRhdGE="
	}`

	var payload EncryptedPayload
	if err := json.Unmarshal([]byte(nodeJSPayload), &payload); err != nil {
		t.Fatalf("Failed to unmarshal payload: %v", err)
	}

	if !payload.Encrypted {
		t.Fatal("Expected encrypted=true")
	}
}

func TestNoEncryption(t *testing.T) {
	plaintext := []byte(`{"test": "data"}`)

	encrypted, err := Encrypt(plaintext, "")
	if err != nil {
		t.Fatalf("Encrypt failed: %v", err)
	}

	if encrypted.Encrypted {
		t.Fatal("Expected encrypted=false when no key provided")
	}

	decrypted, err := Decrypt(encrypted, "")
	if err != nil {
		t.Fatalf("Decrypt failed: %v", err)
	}

	if string(decrypted) != string(plaintext) {
		t.Fatalf("Decrypted text doesn't match: got %s, want %s", decrypted, plaintext)
	}
}
