package license

import (
	"context"
	"crypto/ed25519"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"runtime"
	"strings"
	"time"

	"github.com/cronye/daemon/internal/config"
	"github.com/cronye/daemon/internal/settings"
)

type Service struct {
	logger           *slog.Logger
	settings         *settings.Repository
	publicKey        ed25519.PublicKey
	allowUnsignedDev bool
	deviceID         string
}

type Status struct {
	Active        bool   `json:"active"`
	Status        string `json:"status"`
	Message       string `json:"message,omitempty"`
	DeviceID      string `json:"device_id"`
	LicenseID     string `json:"license_id,omitempty"`
	Email         string `json:"email,omitempty"`
	Plan          string `json:"plan,omitempty"`
	ActivatedAt   string `json:"activated_at,omitempty"`
	LastCheckedAt string `json:"last_checked_at,omitempty"`
	ExpiresAt     string `json:"expires_at,omitempty"`
}

func NewService(logger *slog.Logger, settingsRepo *settings.Repository, cfg config.Config) (*Service, error) {
	deviceID, err := computeDeviceID()
	if err != nil {
		return nil, err
	}

	publicKey, err := parsePublicKey(cfg.LicensePublicKey)
	if err != nil {
		return nil, err
	}

	return &Service{
		logger:           logger,
		settings:         settingsRepo,
		publicKey:        publicKey,
		allowUnsignedDev: cfg.LicenseAllowUnsignedDev,
		deviceID:         deviceID,
	}, nil
}

func (s *Service) Status(ctx context.Context) (Status, error) {
	token, err := s.settings.Get(ctx, settings.KeyLicenseToken)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return s.baseStatus("missing", "license_not_activated"), nil
		}
		return Status{}, err
	}

	status, claims, verifyErr := s.verify(token)
	now := time.Now().UTC().Format(time.RFC3339Nano)
	_ = s.settings.Upsert(ctx, settings.KeyLicenseLastCheckedAt, now)

	if verifyErr != nil {
		status.Message = verifyErr.Error()
		return status, nil
	}
	status.LicenseID = claims.LicenseID
	status.Email = claims.Email
	status.Plan = claims.Plan
	status.ExpiresAt = claims.ExpiresAt
	activatedAt, _ := s.settings.Get(ctx, settings.KeyLicenseActivatedAt)
	lastCheckedAt, _ := s.settings.Get(ctx, settings.KeyLicenseLastCheckedAt)
	status.ActivatedAt = activatedAt
	status.LastCheckedAt = lastCheckedAt
	return status, nil
}

func (s *Service) Activate(ctx context.Context, token string) (Status, error) {
	token = strings.TrimSpace(token)
	if token == "" {
		return s.baseStatus("invalid", "license_key_required"), errors.New("license_key_required")
	}

	status, claims, err := s.verify(token)
	if err != nil {
		status.Message = err.Error()
		return status, err
	}

	now := time.Now().UTC().Format(time.RFC3339Nano)
	if err := s.settings.Upsert(ctx, settings.KeyLicenseToken, token); err != nil {
		return Status{}, err
	}
	if err := s.settings.Upsert(ctx, settings.KeyLicenseActivatedAt, now); err != nil {
		return Status{}, err
	}
	if err := s.settings.Upsert(ctx, settings.KeyLicenseLastCheckedAt, now); err != nil {
		return Status{}, err
	}

	status.LicenseID = claims.LicenseID
	status.Email = claims.Email
	status.Plan = claims.Plan
	status.ActivatedAt = now
	status.LastCheckedAt = now
	status.ExpiresAt = claims.ExpiresAt

	s.logger.Info("license activated", "license_id", claims.LicenseID, "email", claims.Email)
	return status, nil
}

func (s *Service) Deactivate(ctx context.Context) error {
	if err := s.settings.Delete(ctx, settings.KeyLicenseToken); err != nil {
		return err
	}
	if err := s.settings.Delete(ctx, settings.KeyLicenseActivatedAt); err != nil {
		return err
	}
	if err := s.settings.Delete(ctx, settings.KeyLicenseLastCheckedAt); err != nil {
		return err
	}
	return nil
}

func (s *Service) baseStatus(status, message string) Status {
	return Status{
		Active:   false,
		Status:   status,
		Message:  message,
		DeviceID: s.deviceID,
	}
}

func (s *Service) verify(token string) (Status, Claims, error) {
	if strings.TrimSpace(token) == "" {
		return s.baseStatus("missing", "license_not_activated"), Claims{}, errors.New("license_not_activated")
	}

	if len(s.publicKey) == 0 {
		if s.allowUnsignedDev && strings.HasPrefix(token, "plain:") {
			payload := strings.TrimPrefix(token, "plain:")
			decoded, err := base64.RawURLEncoding.DecodeString(payload)
			if err != nil {
				return s.baseStatus("invalid", "invalid_dev_license"), Claims{}, errors.New("invalid_dev_license")
			}
			var claims Claims
			if err := json.Unmarshal(decoded, &claims); err != nil {
				return s.baseStatus("invalid", "invalid_dev_license"), Claims{}, errors.New("invalid_dev_license")
			}
			if err := s.validateTimeBounds(claims); err != nil {
				return s.baseStatus(statusForTimeError(err), err.Error()), Claims{}, err
			}
			st := Status{
				Active:   true,
				Status:   "active",
				DeviceID: s.deviceID,
			}
			return st, claims, nil
		}
		return s.baseStatus("unconfigured", "license_public_key_not_configured"), Claims{}, errors.New("license_public_key_not_configured")
	}

	claims, err := VerifyToken(s.publicKey, token)
	if err != nil {
		return s.baseStatus("invalid", err.Error()), Claims{}, err
	}

	if err := s.validateTimeBounds(claims); err != nil {
		return s.baseStatus(statusForTimeError(err), err.Error()), Claims{}, err
	}

	return Status{
		Active:   true,
		Status:   "active",
		DeviceID: s.deviceID,
	}, claims, nil
}

func (s *Service) validateTimeBounds(claims Claims) error {
	now := time.Now().UTC()

	if strings.TrimSpace(claims.NotBefore) != "" {
		nbf, err := time.Parse(time.RFC3339, claims.NotBefore)
		if err != nil {
			return errors.New("invalid_not_before")
		}
		if now.Before(nbf) {
			return errors.New("license_not_yet_valid")
		}
	}

	if strings.TrimSpace(claims.ExpiresAt) != "" {
		exp, err := time.Parse(time.RFC3339, claims.ExpiresAt)
		if err != nil {
			return errors.New("invalid_expires_at")
		}
		if now.After(exp) {
			return errors.New("license_expired")
		}
	}

	return nil
}

func statusForTimeError(err error) string {
	switch err.Error() {
	case "license_expired":
		return "expired"
	case "license_not_yet_valid":
		return "not_yet_valid"
	default:
		return "invalid"
	}
}

func parsePublicKey(raw string) (ed25519.PublicKey, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, nil
	}
	decoded, err := base64.StdEncoding.DecodeString(raw)
	if err != nil {
		decoded, err = base64.RawStdEncoding.DecodeString(raw)
	}
	if err != nil {
		return nil, errors.New("invalid_license_public_key")
	}
	if len(decoded) != ed25519.PublicKeySize {
		return nil, errors.New("invalid_license_public_key")
	}
	return ed25519.PublicKey(decoded), nil
}

func computeDeviceID() (string, error) {
	host, err := os.Hostname()
	if err != nil {
		return "", err
	}
	sum := sha256.Sum256([]byte(fmt.Sprintf("%s|%s|%s", host, runtime.GOOS, runtime.GOARCH)))
	return fmt.Sprintf("dev_%x", sum[:8]), nil
}
