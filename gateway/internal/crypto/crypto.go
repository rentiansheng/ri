package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
)

const (
	IVLength      = 12
	AuthTagLength = 16
)

type EncryptedPayload struct {
	Encrypted bool            `json:"encrypted"`
	IV        string          `json:"iv,omitempty"`
	AuthTag   string          `json:"authTag,omitempty"`
	Data      json.RawMessage `json:"data"`
}

func DeriveKey(passphrase string) []byte {
	hash := sha256.Sum256([]byte(passphrase))
	return hash[:]
}

func Decrypt(payload *EncryptedPayload, key string) ([]byte, error) {
	if !payload.Encrypted {
		return payload.Data, nil
	}

	if key == "" {
		return nil, errors.New("encryption key required but not provided")
	}

	derivedKey := DeriveKey(key)

	iv, err := base64.StdEncoding.DecodeString(payload.IV)
	if err != nil {
		return nil, errors.New("failed to decode IV: " + err.Error())
	}

	authTag, err := base64.StdEncoding.DecodeString(payload.AuthTag)
	if err != nil {
		return nil, errors.New("failed to decode auth tag: " + err.Error())
	}

	var ciphertextB64 string
	if err := json.Unmarshal(payload.Data, &ciphertextB64); err != nil {
		return nil, errors.New("failed to unmarshal ciphertext: " + err.Error())
	}

	ciphertext, err := base64.StdEncoding.DecodeString(ciphertextB64)
	if err != nil {
		return nil, errors.New("failed to decode ciphertext: " + err.Error())
	}

	block, err := aes.NewCipher(derivedKey)
	if err != nil {
		return nil, errors.New("failed to create cipher: " + err.Error())
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, errors.New("failed to create GCM: " + err.Error())
	}

	ciphertextWithTag := append(ciphertext, authTag...)

	plaintext, err := gcm.Open(nil, iv, ciphertextWithTag, nil)
	if err != nil {
		return nil, errors.New("decryption failed: " + err.Error())
	}

	return plaintext, nil
}

func DecryptJSON(payload *EncryptedPayload, key string, target interface{}) error {
	plaintext, err := Decrypt(payload, key)
	if err != nil {
		return err
	}

	return json.Unmarshal(plaintext, target)
}

func Encrypt(plaintext []byte, key string) (*EncryptedPayload, error) {
	if key == "" {
		return &EncryptedPayload{
			Encrypted: false,
			Data:      plaintext,
		}, nil
	}

	derivedKey := DeriveKey(key)

	block, err := aes.NewCipher(derivedKey)
	if err != nil {
		return nil, errors.New("failed to create cipher: " + err.Error())
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, errors.New("failed to create GCM: " + err.Error())
	}

	iv := make([]byte, IVLength)
	if _, err := io.ReadFull(rand.Reader, iv); err != nil {
		return nil, errors.New("failed to generate IV: " + err.Error())
	}

	ciphertextWithTag := gcm.Seal(nil, iv, plaintext, nil)

	tagStart := len(ciphertextWithTag) - AuthTagLength
	ciphertext := ciphertextWithTag[:tagStart]
	authTag := ciphertextWithTag[tagStart:]

	ciphertextB64, _ := json.Marshal(base64.StdEncoding.EncodeToString(ciphertext))

	return &EncryptedPayload{
		Encrypted: true,
		IV:        base64.StdEncoding.EncodeToString(iv),
		AuthTag:   base64.StdEncoding.EncodeToString(authTag),
		Data:      ciphertextB64,
	}, nil
}

func EncryptJSON(data interface{}, key string) (*EncryptedPayload, error) {
	plaintext, err := json.Marshal(data)
	if err != nil {
		return nil, errors.New("failed to marshal data: " + err.Error())
	}

	return Encrypt(plaintext, key)
}
