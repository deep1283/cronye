package config

import (
	"os"
	"path/filepath"
)

const (
	defaultAddr    = "127.0.0.1:9480"
	defaultDataDir = "var"
)

type Config struct {
	Addr   string
	DBPath string
}

func FromEnv() Config {
	addr := getEnv("CRONYE_ADDR", defaultAddr)
	dataDir := getEnv("CRONYE_DATA_DIR", defaultDataDir)
	dbPath := getEnv("CRONYE_DB_PATH", filepath.Join(dataDir, "cronye.db"))

	return Config{
		Addr:   addr,
		DBPath: dbPath,
	}
}

func getEnv(key, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}
