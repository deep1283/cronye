package app

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

var rootAPIPrefixes = []string{
	"/health",
	"/jobs",
	"/runs",
	"/maintenance",
	"/storage",
	"/settings",
	"/license",
}

func newHTTPHandler(apiHandler http.Handler, uiDistDir string) (http.Handler, string) {
	apiWithAlias := apiAliasHandler(apiHandler)
	uiDir := resolveUIDistDir(uiDistDir)
	uiEnabled := uiDir != ""

	if !uiEnabled {
		return apiWithAlias, ""
	}

	fileServer := http.FileServer(http.Dir(uiDir))
	indexPath := filepath.Join(uiDir, "index.html")
	serveIndex := func(w http.ResponseWriter, r *http.Request) {
		// Always revalidate shell HTML so UI updates are picked up immediately.
		w.Header().Set("Cache-Control", "no-store, max-age=0")
		w.Header().Set("Pragma", "no-cache")
		w.Header().Set("Expires", "0")
		http.ServeFile(w, r, indexPath)
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if isAPIPath(r.URL.Path) {
			apiWithAlias.ServeHTTP(w, r)
			return
		}

		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			http.NotFound(w, r)
			return
		}

		path := strings.TrimPrefix(r.URL.Path, "/")
		if path == "" {
			serveIndex(w, r)
			return
		}

		if strings.EqualFold(path, "index.html") {
			serveIndex(w, r)
			return
		}

		if strings.Contains(filepath.Base(path), ".") {
			if strings.EqualFold(filepath.Base(path), "favicon.png") {
				w.Header().Set("Cache-Control", "no-cache, max-age=0, must-revalidate")
			}
			fileServer.ServeHTTP(w, r)
			return
		}

		// SPA route fallback.
		serveIndex(w, r)
	}), uiDir
}

func apiAliasHandler(apiHandler http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/") || r.URL.Path == "/api" {
			targetPath := strings.TrimPrefix(r.URL.Path, "/api")
			if targetPath == "" {
				targetPath = "/"
			}
			clone := r.Clone(r.Context())
			urlCopy := *r.URL
			urlCopy.Path = targetPath
			clone.URL = &urlCopy
			clone.RequestURI = ""
			apiHandler.ServeHTTP(w, clone)
			return
		}
		apiHandler.ServeHTTP(w, r)
	})
}

func isAPIPath(path string) bool {
	if strings.HasPrefix(path, "/api/") || path == "/api" {
		return true
	}
	for _, prefix := range rootAPIPrefixes {
		if path == prefix || strings.HasPrefix(path, prefix+"/") {
			return true
		}
	}
	return false
}

func resolveUIDistDir(preferred string) string {
	candidates := []string{
		preferred,
		"ui/dist",
		"../ui/dist",
	}
	if execPath, err := os.Executable(); err == nil {
		execDir := filepath.Dir(execPath)
		candidates = append(candidates,
			filepath.Join(execDir, "ui", "dist"),
			filepath.Join(execDir, "..", "ui", "dist"),
		)
	}

	for _, candidate := range candidates {
		candidate = strings.TrimSpace(candidate)
		if candidate == "" {
			continue
		}
		indexPath := filepath.Join(candidate, "index.html")
		if info, err := os.Stat(indexPath); err == nil && !info.IsDir() {
			return candidate
		}
	}

	return ""
}
