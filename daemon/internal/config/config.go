package config

import (
	"os"
	"path/filepath"
	"strconv"
)

const (
	defaultAddr     = "127.0.0.1:9480"
	defaultDataDir  = "var"
	defaultUIDist   = "ui/dist"
	defaultSvcName  = "cronye-daemon"
	defaultSvcLabel = "com.cronye.daemon"
)

type Config struct {
	Addr                    string
	DataDir                 string
	DBPath                  string
	UIDistDir               string
	ServiceName             string
	ServiceLabel            string
	LicensePublicKey        string
	LicenseAllowUnsignedDev bool
}

func FromEnv() Config {
	addr := getEnv("CRONYE_ADDR", defaultAddr)
	dataDir := getEnv("CRONYE_DATA_DIR", defaultDataDir)
	dbPath := getEnv("CRONYE_DB_PATH", filepath.Join(dataDir, "cronye.db"))
	uiDistDir := getEnv("CRONYE_UI_DIST", defaultUIDist)
	serviceName := getEnv("CRONYE_SERVICE_NAME", defaultSvcName)
	serviceLabel := getEnv("CRONYE_SERVICE_LABEL", defaultSvcLabel)
	licensePublicKey := getEnv("CRONYE_LICENSE_PUBLIC_KEY", "")
	allowUnsignedDev, _ := strconv.ParseBool(getEnv("CRONYE_LICENSE_ALLOW_UNSIGNED_DEV", "false"))

	return Config{
		Addr:                    addr,
		DataDir:                 dataDir,
		DBPath:                  dbPath,
		UIDistDir:               uiDistDir,
		ServiceName:             serviceName,
		ServiceLabel:            serviceLabel,
		LicensePublicKey:        licensePublicKey,
		LicenseAllowUnsignedDev: allowUnsignedDev,
	}
}

func getEnv(key, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}
