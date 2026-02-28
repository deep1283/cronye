package app

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestNewHTTPHandlerServesAPIAndUI(t *testing.T) {
	t.Parallel()

	tempDir := t.TempDir()
	mustWriteFile(t, filepath.Join(tempDir, "index.html"), "<html>ui-index</html>")
	mustWriteFile(t, filepath.Join(tempDir, "assets", "app.js"), "console.log('ok')")

	apiRouter := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.URL.Path == "/health":
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte("api-health"))
		case strings.HasPrefix(r.URL.Path, "/jobs"):
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte("api-jobs"))
		default:
			http.NotFound(w, r)
		}
	})

	handler, resolved := newHTTPHandler(apiRouter, tempDir)
	if resolved == "" {
		t.Fatalf("expected resolved ui dir, got empty")
	}

	healthReq := httptest.NewRequest(http.MethodGet, "/health", nil)
	healthRes := httptest.NewRecorder()
	handler.ServeHTTP(healthRes, healthReq)
	if healthRes.Code != http.StatusOK || !strings.Contains(healthRes.Body.String(), "api-health") {
		t.Fatalf("expected /health API response, got status=%d body=%q", healthRes.Code, healthRes.Body.String())
	}

	apiHealthReq := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	apiHealthRes := httptest.NewRecorder()
	handler.ServeHTTP(apiHealthRes, apiHealthReq)
	if apiHealthRes.Code != http.StatusOK || !strings.Contains(apiHealthRes.Body.String(), "api-health") {
		t.Fatalf("expected /api/health API response, got status=%d body=%q", apiHealthRes.Code, apiHealthRes.Body.String())
	}

	uiReq := httptest.NewRequest(http.MethodGet, "/", nil)
	uiRes := httptest.NewRecorder()
	handler.ServeHTTP(uiRes, uiReq)
	if uiRes.Code != http.StatusOK || !strings.Contains(uiRes.Body.String(), "ui-index") {
		t.Fatalf("expected root UI index response, got status=%d body=%q", uiRes.Code, uiRes.Body.String())
	}

	assetReq := httptest.NewRequest(http.MethodGet, "/assets/app.js", nil)
	assetRes := httptest.NewRecorder()
	handler.ServeHTTP(assetRes, assetReq)
	if assetRes.Code != http.StatusOK || !strings.Contains(assetRes.Body.String(), "console.log") {
		t.Fatalf("expected asset response, got status=%d body=%q", assetRes.Code, assetRes.Body.String())
	}

	spaReq := httptest.NewRequest(http.MethodGet, "/jobs/ui/view", nil)
	spaRes := httptest.NewRecorder()
	handler.ServeHTTP(spaRes, spaReq)
	if spaRes.Code != http.StatusOK || !strings.Contains(spaRes.Body.String(), "api-jobs") {
		t.Fatalf("expected API precedence for /jobs route, got status=%d body=%q", spaRes.Code, spaRes.Body.String())
	}

	spaFallbackReq := httptest.NewRequest(http.MethodGet, "/dashboard/runs", nil)
	spaFallbackRes := httptest.NewRecorder()
	handler.ServeHTTP(spaFallbackRes, spaFallbackReq)
	if spaFallbackRes.Code != http.StatusOK || !strings.Contains(spaFallbackRes.Body.String(), "ui-index") {
		t.Fatalf("expected SPA fallback to index, got status=%d body=%q", spaFallbackRes.Code, spaFallbackRes.Body.String())
	}
}

func TestNewHTTPHandlerAPIOnlyWhenUIDirMissing(t *testing.T) {
	t.Parallel()

	apiRouter := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/health" {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte("api-health"))
			return
		}
		http.NotFound(w, r)
	})

	handler, resolved := newHTTPHandler(apiRouter, filepath.Join(t.TempDir(), "missing"))
	if resolved != "" {
		t.Fatalf("expected no resolved ui dir, got %q", resolved)
	}

	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	res := httptest.NewRecorder()
	handler.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("expected API /health to work in API-only mode, got %d", res.Code)
	}

	apiReq := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	apiRes := httptest.NewRecorder()
	handler.ServeHTTP(apiRes, apiReq)
	if apiRes.Code != http.StatusOK {
		t.Fatalf("expected /api alias in API-only mode, got %d", apiRes.Code)
	}

	uiReq := httptest.NewRequest(http.MethodGet, "/", nil)
	uiRes := httptest.NewRecorder()
	handler.ServeHTTP(uiRes, uiReq)
	if uiRes.Code != http.StatusNotFound {
		t.Fatalf("expected UI path to return 404 in API-only mode, got %d", uiRes.Code)
	}
}

func mustWriteFile(t *testing.T, path, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatalf("mkdir %s: %v", path, err)
	}
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatalf("write file %s: %v", path, err)
	}
}
