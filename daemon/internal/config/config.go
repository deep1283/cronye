package config

import (
	"os"
	"path/filepath"
	"strconv"
)

const (
	defaultAddr              = "127.0.0.1:9480"
	defaultDataDir           = "var"
	defaultUIDist            = "ui/dist"
	defaultSvcName           = "cronye-daemon"
	defaultSvcLabel          = "com.cronye.daemon"
	defaultRunnerConcurrency = 4
)

type Config struct {
	Addr              string
	DataDir           string
	DBPath            string
	UIDistDir         string
	ServiceName       string
	ServiceLabel      string
	LicensePublicKey  string
	RunnerConcurrency int
}

func FromEnv() Config {
	addr := getEnv("CRONYE_ADDR", defaultAddr)
	dataDir := getEnv("CRONYE_DATA_DIR", defaultDataDir)
	dbPath := getEnv("CRONYE_DB_PATH", filepath.Join(dataDir, "cronye.db"))
	uiDistDir := getEnv("CRONYE_UI_DIST", defaultUIDist)
	serviceName := getEnv("CRONYE_SERVICE_NAME", defaultSvcName)
	serviceLabel := getEnv("CRONYE_SERVICE_LABEL", defaultSvcLabel)
	licensePublicKey := getEnv("CRONYE_LICENSE_PUBLIC_KEY", "")
	runnerConcurrency := getEnvInt("CRONYE_RUNNER_CONCURRENCY", defaultRunnerConcurrency)
	if runnerConcurrency < 1 {
		runnerConcurrency = defaultRunnerConcurrency
	}

	return Config{
		Addr:              addr,
		DataDir:           dataDir,
		DBPath:            dbPath,
		UIDistDir:         uiDistDir,
		ServiceName:       serviceName,
		ServiceLabel:      serviceLabel,
		LicensePublicKey:  licensePublicKey,
		RunnerConcurrency: runnerConcurrency,
	}
}

func getEnv(key, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}

func getEnvInt(key string, fallback int) int {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	return parsed
}
