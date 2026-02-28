package license

import (
	"crypto/ed25519"
	"encoding/base64"
	"encoding/json"
	"errors"
	"strings"
)

const tokenVersion = "cronye1"

type Claims struct {
	LicenseID   string `json:"license_id"`
	Email       string `json:"email"`
	Plan        string `json:"plan"`
	IssuedAt    string `json:"issued_at"`
	NotBefore   string `json:"not_before,omitempty"`
	ExpiresAt   string `json:"expires_at,omitempty"`
	DeviceLimit int    `json:"device_limit,omitempty"`
}

func SignToken(privateKey ed25519.PrivateKey, claims Claims) (string, error) {
	if len(privateKey) != ed25519.PrivateKeySize {
		return "", errors.New("invalid_private_key")
	}
	if err := validateClaims(claims); err != nil {
		return "", err
	}

	payload, err := json.Marshal(claims)
	if err != nil {
		return "", err
	}

	sig := ed25519.Sign(privateKey, payload)
	return tokenVersion + "." +
		base64.RawURLEncoding.EncodeToString(payload) + "." +
		base64.RawURLEncoding.EncodeToString(sig), nil
}

func VerifyToken(publicKey ed25519.PublicKey, token string) (Claims, error) {
	parts := strings.Split(strings.TrimSpace(token), ".")
	if len(parts) != 3 || parts[0] != tokenVersion {
		return Claims{}, errors.New("invalid_license_format")
	}

	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return Claims{}, errors.New("invalid_license_payload")
	}
	signature, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return Claims{}, errors.New("invalid_license_signature")
	}
	if len(publicKey) != ed25519.PublicKeySize || !ed25519.Verify(publicKey, payload, signature) {
		return Claims{}, errors.New("invalid_license_signature")
	}

	var claims Claims
	if err := json.Unmarshal(payload, &claims); err != nil {
		return Claims{}, errors.New("invalid_license_claims")
	}

	if err := validateClaims(claims); err != nil {
		return Claims{}, err
	}
	return claims, nil
}

func validateClaims(claims Claims) error {
	if strings.TrimSpace(claims.LicenseID) == "" {
		return errors.New("license_id_required")
	}
	if strings.TrimSpace(claims.Email) == "" {
		return errors.New("email_required")
	}
	if strings.TrimSpace(claims.Plan) == "" {
		return errors.New("plan_required")
	}
	if strings.TrimSpace(claims.IssuedAt) == "" {
		return errors.New("issued_at_required")
	}
	return nil
}
