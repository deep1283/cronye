package license

import (
	"crypto/ed25519"
	"crypto/rand"
	"testing"
	"time"
)

func TestSignAndVerifyToken(t *testing.T) {
	t.Parallel()

	publicKey, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("generate key pair: %v", err)
	}

	claims := Claims{
		LicenseID:   "lic_123",
		Email:       "test@example.com",
		Plan:        "lifetime",
		IssuedAt:    time.Now().UTC().Format(time.RFC3339),
		DeviceLimit: 1,
	}

	token, err := SignToken(privateKey, claims)
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}

	verifiedClaims, err := VerifyToken(publicKey, token)
	if err != nil {
		t.Fatalf("verify token: %v", err)
	}

	if verifiedClaims.LicenseID != claims.LicenseID {
		t.Fatalf("expected license id %q, got %q", claims.LicenseID, verifiedClaims.LicenseID)
	}
	if verifiedClaims.Email != claims.Email {
		t.Fatalf("expected email %q, got %q", claims.Email, verifiedClaims.Email)
	}
}

func TestVerifyTokenRejectsInvalidSignature(t *testing.T) {
	t.Parallel()

	publicKey, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("generate key pair: %v", err)
	}

	claims := Claims{
		LicenseID: "lic_bad",
		Email:     "bad@example.com",
		Plan:      "lifetime",
		IssuedAt:  time.Now().UTC().Format(time.RFC3339),
	}

	token, err := SignToken(privateKey, claims)
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}

	token = token + "tampered"
	if _, err := VerifyToken(publicKey, token); err == nil {
		t.Fatalf("expected verification error for tampered token")
	}
}
