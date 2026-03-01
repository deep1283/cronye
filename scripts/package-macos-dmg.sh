#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This script must run on macOS."
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="${VERSION:-dev}"
GOARCH="${GOARCH:-arm64}"
APP_NAME="${APP_NAME:-Cronye}"
BUNDLE_ID="${BUNDLE_ID:-app.cronye.desktop}"
WORK_DIR="${WORK_DIR:-${ROOT_DIR}/dist/macos-packaging/${VERSION}-darwin-${GOARCH}}"
OUTPUT_DMG="${OUTPUT_DMG:-${ROOT_DIR}/dist/release/${VERSION}-darwin-${GOARCH}/cronye-macos.dmg}"
RELEASE_BIN_NAME="cronye-daemon-${GOARCH}"
BUILD_VERSION_LDFLAG="-X github.com/cronye/daemon/internal/version.BuildVersion=${VERSION}"
GO_CACHE_DIR="${GO_CACHE_DIR:-${ROOT_DIR}/daemon/.cache/go-build}"
GO_MOD_CACHE_DIR="${GO_MOD_CACHE_DIR:-${ROOT_DIR}/daemon/.cache/gomod}"

if [[ "${GOARCH}" != "arm64" ]]; then
  echo "This installer is intended for Apple Silicon. Received GOARCH=${GOARCH}."
  exit 1
fi

echo "==> Cleaning build workspace"
rm -rf "${WORK_DIR}"
mkdir -p "${WORK_DIR}"

echo "==> Building UI bundle"
(
  cd "${ROOT_DIR}/ui"
  npm run build
)

echo "==> Building daemon binary (${GOARCH})"
mkdir -p "${GO_CACHE_DIR}" "${GO_MOD_CACHE_DIR}"
(
  cd "${ROOT_DIR}/daemon"
  GOCACHE="${GO_CACHE_DIR}" GOMODCACHE="${GO_MOD_CACHE_DIR}" \
    CGO_ENABLED=1 GOOS=darwin GOARCH="${GOARCH}" \
    go build -ldflags "${BUILD_VERSION_LDFLAG}" \
    -o "${WORK_DIR}/${RELEASE_BIN_NAME}" \
    ./cmd/daemon
)

APP_DIR="${WORK_DIR}/${APP_NAME}.app"
CONTENTS_DIR="${APP_DIR}/Contents"
MACOS_DIR="${CONTENTS_DIR}/MacOS"
RES_DIR="${CONTENTS_DIR}/Resources"
BIN_DIR="${RES_DIR}/bin"
UI_DIR="${RES_DIR}/ui"
ICON_FILE="${RES_DIR}/${APP_NAME}.icns"
LAUNCHER_PATH="${MACOS_DIR}/${APP_NAME}"

echo "==> Assembling app bundle"
mkdir -p "${MACOS_DIR}" "${BIN_DIR}" "${UI_DIR}"
cp -R "${ROOT_DIR}/ui/dist" "${UI_DIR}/dist"
cp "${WORK_DIR}/${RELEASE_BIN_NAME}" "${BIN_DIR}/${RELEASE_BIN_NAME}"
chmod +x "${BIN_DIR}/${RELEASE_BIN_NAME}"

if [[ -n "${CRONYE_LICENSE_PUBLIC_KEY:-}" ]]; then
  printf "%s" "${CRONYE_LICENSE_PUBLIC_KEY}" > "${RES_DIR}/license_public_key.txt"
fi

cat > "${LAUNCHER_PATH}" <<'SH'
#!/usr/bin/env bash
set -euo pipefail

SELF_DIR="$(cd "$(dirname "$0")" && pwd)"
CONTENTS_DIR="$(cd "${SELF_DIR}/.." && pwd)"
RESOURCES_DIR="${CONTENTS_DIR}/Resources"
BIN="${RESOURCES_DIR}/bin/cronye-daemon-arm64"
UI_DIST="${RESOURCES_DIR}/ui/dist"
DATA_DIR="${HOME}/Library/Application Support/Cronye"
LOG_DIR="${HOME}/Library/Logs/Cronye"
PID_FILE="${DATA_DIR}/daemon.pid"
KEY_FILE="${RESOURCES_DIR}/license_public_key.txt"

mkdir -p "${DATA_DIR}" "${LOG_DIR}"

is_pid_running() {
  local pid
  if [[ ! -f "${PID_FILE}" ]]; then
    return 1
  fi

  pid="$(cat "${PID_FILE}" 2>/dev/null || true)"
  if [[ -z "${pid}" ]]; then
    return 1
  fi

  kill -0 "${pid}" 2>/dev/null
}

if ! is_pid_running; then
  export CRONYE_DATA_DIR="${DATA_DIR}"
  export CRONYE_UI_DIST="${UI_DIST}"
  if [[ -f "${KEY_FILE}" ]]; then
    export CRONYE_LICENSE_PUBLIC_KEY="$(tr -d '\r\n ' < "${KEY_FILE}")"
  fi

  "${BIN}" >> "${LOG_DIR}/daemon.log" 2>&1 &
  echo "$!" > "${PID_FILE}"
  sleep 0.4
fi

open "http://127.0.0.1:9480"
SH
chmod +x "${LAUNCHER_PATH}"

cat > "${CONTENTS_DIR}/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple Computer//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key>
  <string>${APP_NAME}</string>
  <key>CFBundleDisplayName</key>
  <string>${APP_NAME}</string>
  <key>CFBundleIdentifier</key>
  <string>${BUNDLE_ID}</string>
  <key>CFBundleVersion</key>
  <string>${VERSION}</string>
  <key>CFBundleShortVersionString</key>
  <string>${VERSION}</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleExecutable</key>
  <string>${APP_NAME}</string>
  <key>CFBundleIconFile</key>
  <string>${APP_NAME}.icns</string>
  <key>LSMinimumSystemVersion</key>
  <string>12.0</string>
  <key>NSHighResolutionCapable</key>
  <true/>
</dict>
</plist>
PLIST

ICON_SOURCE="${ROOT_DIR}/landing/public/branding/mascot.png"
if [[ -f "${ICON_SOURCE}" ]]; then
  echo "==> Generating app icon"
  ICONSET_DIR="${WORK_DIR}/${APP_NAME}.iconset"
  mkdir -p "${ICONSET_DIR}"
  sips -z 16 16 "${ICON_SOURCE}" --out "${ICONSET_DIR}/icon_16x16.png" >/dev/null
  sips -z 32 32 "${ICON_SOURCE}" --out "${ICONSET_DIR}/icon_16x16@2x.png" >/dev/null
  sips -z 32 32 "${ICON_SOURCE}" --out "${ICONSET_DIR}/icon_32x32.png" >/dev/null
  sips -z 64 64 "${ICON_SOURCE}" --out "${ICONSET_DIR}/icon_32x32@2x.png" >/dev/null
  sips -z 128 128 "${ICON_SOURCE}" --out "${ICONSET_DIR}/icon_128x128.png" >/dev/null
  sips -z 256 256 "${ICON_SOURCE}" --out "${ICONSET_DIR}/icon_128x128@2x.png" >/dev/null
  sips -z 256 256 "${ICON_SOURCE}" --out "${ICONSET_DIR}/icon_256x256.png" >/dev/null
  sips -z 512 512 "${ICON_SOURCE}" --out "${ICONSET_DIR}/icon_256x256@2x.png" >/dev/null
  sips -z 512 512 "${ICON_SOURCE}" --out "${ICONSET_DIR}/icon_512x512.png" >/dev/null
  sips -z 1024 1024 "${ICON_SOURCE}" --out "${ICONSET_DIR}/icon_512x512@2x.png" >/dev/null
  if ! iconutil -c icns "${ICONSET_DIR}" -o "${ICON_FILE}"; then
    echo "warning: iconutil failed, continuing with default app icon"
    rm -f "${ICON_FILE}"
  fi
fi

echo "==> Building DMG"
DMG_STAGE_DIR="${WORK_DIR}/dmg-stage"
mkdir -p "${DMG_STAGE_DIR}"
cp -R "${APP_DIR}" "${DMG_STAGE_DIR}/${APP_NAME}.app"
ln -s /Applications "${DMG_STAGE_DIR}/Applications"

mkdir -p "$(dirname "${OUTPUT_DMG}")"
rm -f "${OUTPUT_DMG}"
hdiutil create -volname "${APP_NAME}" -srcfolder "${DMG_STAGE_DIR}" -ov -format UDZO "${OUTPUT_DMG}" >/dev/null
shasum -a 256 "${OUTPUT_DMG}" > "${OUTPUT_DMG}.sha256"

echo
echo "Installer ready:"
echo "  ${OUTPUT_DMG}"
echo "  ${OUTPUT_DMG}.sha256"
