package osservice

import (
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/cronye/daemon/internal/config"
)

func Install(cfg config.Config) error {
	switch runtime.GOOS {
	case "darwin":
		return installLaunchd(cfg)
	case "linux":
		return installSystemd(cfg)
	case "windows":
		return installWindowsService(cfg)
	default:
		return fmt.Errorf("unsupported_os_%s", runtime.GOOS)
	}
}

func Uninstall(cfg config.Config) error {
	switch runtime.GOOS {
	case "darwin":
		return uninstallLaunchd(cfg)
	case "linux":
		return uninstallSystemd(cfg)
	case "windows":
		return uninstallWindowsService(cfg)
	default:
		return fmt.Errorf("unsupported_os_%s", runtime.GOOS)
	}
}

func installLaunchd(cfg config.Config) error {
	home, err := os.UserHomeDir()
	if err != nil {
		return err
	}
	agentPath := filepath.Join(home, "Library", "LaunchAgents", cfg.ServiceLabel+".plist")
	if err := os.MkdirAll(filepath.Dir(agentPath), 0o755); err != nil {
		return err
	}

	exe, err := serviceExecutablePath()
	if err != nil {
		return err
	}
	dataDir := absOrOriginal(cfg.DataDir)
	dbPath := absOrOriginal(cfg.DBPath)
	uiDist := absOrOriginal(cfg.UIDistDir)

	logPath := filepath.Join(dataDir, "service.log")
	errPath := filepath.Join(dataDir, "service.err.log")
	_ = os.MkdirAll(dataDir, 0o755)

	content := fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>%s</string>
    <key>ProgramArguments</key>
    <array>
      <string>%s</string>
    </array>
    <key>EnvironmentVariables</key>
    <dict>
      <key>CRONYE_ADDR</key><string>%s</string>
      <key>CRONYE_DATA_DIR</key><string>%s</string>
      <key>CRONYE_DB_PATH</key><string>%s</string>
      <key>CRONYE_UI_DIST</key><string>%s</string>
      <key>CRONYE_SERVICE_NAME</key><string>%s</string>
      <key>CRONYE_SERVICE_LABEL</key><string>%s</string>
      <key>CRONYE_LICENSE_PUBLIC_KEY</key><string>%s</string>
    </dict>
    <key>RunAtLoad</key><true/>
    <key>KeepAlive</key><true/>
    <key>StandardOutPath</key><string>%s</string>
    <key>StandardErrorPath</key><string>%s</string>
  </dict>
</plist>
`, cfg.ServiceLabel, exe, cfg.Addr, dataDir, dbPath, uiDist, cfg.ServiceName, cfg.ServiceLabel, cfg.LicensePublicKey, logPath, errPath)

	if err := os.WriteFile(agentPath, []byte(content), 0o644); err != nil {
		return err
	}

	_ = exec.Command("launchctl", "unload", agentPath).Run()
	if out, err := exec.Command("launchctl", "load", agentPath).CombinedOutput(); err != nil {
		return fmt.Errorf("launchctl_load_failed: %v (%s)", err, strings.TrimSpace(string(out)))
	}
	return nil
}

func uninstallLaunchd(cfg config.Config) error {
	home, err := os.UserHomeDir()
	if err != nil {
		return err
	}
	agentPath := filepath.Join(home, "Library", "LaunchAgents", cfg.ServiceLabel+".plist")
	_ = exec.Command("launchctl", "unload", agentPath).Run()
	if err := os.Remove(agentPath); err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}
	return nil
}

func installSystemd(cfg config.Config) error {
	if os.Geteuid() != 0 {
		return errors.New("linux_service_install_requires_root")
	}
	exe, err := serviceExecutablePath()
	if err != nil {
		return err
	}
	dataDir := absOrOriginal(cfg.DataDir)
	dbPath := absOrOriginal(cfg.DBPath)
	uiDist := absOrOriginal(cfg.UIDistDir)

	unitPath := filepath.Join("/etc/systemd/system", cfg.ServiceName+".service")
	unit := fmt.Sprintf(`[Unit]
Description=Cronye Daemon
After=network.target

[Service]
Type=simple
ExecStart=%s
Restart=on-failure
RestartSec=5
Environment=CRONYE_ADDR=%s
Environment=CRONYE_DATA_DIR=%s
Environment=CRONYE_DB_PATH=%s
Environment=CRONYE_UI_DIST=%s
Environment=CRONYE_SERVICE_NAME=%s
Environment=CRONYE_SERVICE_LABEL=%s
Environment=CRONYE_LICENSE_PUBLIC_KEY=%s

[Install]
WantedBy=multi-user.target
`, exe, cfg.Addr, dataDir, dbPath, uiDist, cfg.ServiceName, cfg.ServiceLabel, cfg.LicensePublicKey)

	if err := os.WriteFile(unitPath, []byte(unit), 0o644); err != nil {
		return err
	}
	if out, err := exec.Command("systemctl", "daemon-reload").CombinedOutput(); err != nil {
		return fmt.Errorf("systemctl_daemon_reload_failed: %v (%s)", err, strings.TrimSpace(string(out)))
	}
	if out, err := exec.Command("systemctl", "enable", "--now", cfg.ServiceName).CombinedOutput(); err != nil {
		return fmt.Errorf("systemctl_enable_failed: %v (%s)", err, strings.TrimSpace(string(out)))
	}
	return nil
}

func uninstallSystemd(cfg config.Config) error {
	if os.Geteuid() != 0 {
		return errors.New("linux_service_uninstall_requires_root")
	}

	_ = exec.Command("systemctl", "disable", "--now", cfg.ServiceName).Run()
	unitPath := filepath.Join("/etc/systemd/system", cfg.ServiceName+".service")
	if err := os.Remove(unitPath); err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}
	if out, err := exec.Command("systemctl", "daemon-reload").CombinedOutput(); err != nil {
		return fmt.Errorf("systemctl_daemon_reload_failed: %v (%s)", err, strings.TrimSpace(string(out)))
	}
	return nil
}

func installWindowsService(cfg config.Config) error {
	exe, err := serviceExecutablePath()
	if err != nil {
		return err
	}

	binPath := fmt.Sprintf(`"%s"`, exe)
	if out, err := exec.Command("sc.exe", "create", cfg.ServiceName, "binPath=", binPath, "start=", "auto", "DisplayName=", "Cronye Daemon").CombinedOutput(); err != nil {
		return fmt.Errorf("sc_create_failed: %v (%s)", err, strings.TrimSpace(string(out)))
	}
	_ = exec.Command("sc.exe", "failure", cfg.ServiceName, "reset=", "0", "actions=", "restart/5000/restart/15000/\"\"/0").Run()
	_ = exec.Command("sc.exe", "start", cfg.ServiceName).Run()
	return nil
}

func uninstallWindowsService(cfg config.Config) error {
	_ = exec.Command("sc.exe", "stop", cfg.ServiceName).Run()
	if out, err := exec.Command("sc.exe", "delete", cfg.ServiceName).CombinedOutput(); err != nil {
		return fmt.Errorf("sc_delete_failed: %v (%s)", err, strings.TrimSpace(string(out)))
	}
	return nil
}

func absOrOriginal(path string) string {
	if abs, err := filepath.Abs(path); err == nil {
		return abs
	}
	return path
}

func serviceExecutablePath() (string, error) {
	exe, err := os.Executable()
	if err != nil {
		return "", err
	}
	clean := filepath.Clean(exe)
	if strings.Contains(clean, "go-build") && strings.HasPrefix(clean, os.TempDir()) {
		return "", errors.New("service_install_requires_built_binary_not_go_run")
	}
	return clean, nil
}
