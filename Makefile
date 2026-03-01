.PHONY: ui-build daemon-test daemon-build licensegen-build release release-host release-signed release-all release-matrix sign-artifacts package-macos-dmg

VERSION ?= dev
GOOS ?= $(shell cd daemon && go env GOOS)
GOARCH ?= $(shell cd daemon && go env GOARCH)
GO_CACHE_DIR ?= $(abspath daemon/.cache/go-build)
GO_MOD_CACHE_DIR ?= $(abspath daemon/.cache/gomod)
SIGNING_REQUIRED ?= 0
SIGNING_KEY_PATH ?=
RELEASE_TARGETS ?= $(GOOS)/$(GOARCH)
RELEASE_MATRIX_TARGETS ?= darwin/arm64 darwin/amd64 linux/amd64 linux/arm64 windows/amd64

RELEASE_DIR := dist/release/$(VERSION)-$(GOOS)-$(GOARCH)
DAEMON_BIN := cronye-daemon
LICENSEGEN_BIN := cronye-licensegen

ifeq ($(GOOS),windows)
DAEMON_BIN := cronye-daemon.exe
LICENSEGEN_BIN := cronye-licensegen.exe
endif

ui-build:
	cd ui && npm run build

daemon-test:
	cd daemon && GOCACHE=$(GO_CACHE_DIR) GOMODCACHE=$(GO_MOD_CACHE_DIR) go test ./...

daemon-build:
	cd daemon && GOCACHE=$(GO_CACHE_DIR) GOMODCACHE=$(GO_MOD_CACHE_DIR) CGO_ENABLED=1 GOOS=$(GOOS) GOARCH=$(GOARCH) go build -ldflags "-X github.com/cronye/daemon/internal/version.BuildVersion=$(VERSION)" -o ../$(RELEASE_DIR)/$(DAEMON_BIN) ./cmd/daemon

licensegen-build:
	cd daemon && GOCACHE=$(GO_CACHE_DIR) GOMODCACHE=$(GO_MOD_CACHE_DIR) CGO_ENABLED=0 GOOS=$(GOOS) GOARCH=$(GOARCH) go build -ldflags "-X github.com/cronye/daemon/internal/version.BuildVersion=$(VERSION)" -o ../$(RELEASE_DIR)/$(LICENSEGEN_BIN) ./cmd/licensegen

sign-artifacts:
	@set -e; \
	if [ "$(SIGNING_REQUIRED)" != "1" ]; then \
		echo "Signing disabled (set SIGNING_REQUIRED=1 and SIGNING_KEY_PATH=/path/to/private.pem)"; \
	else \
		if [ ! -f "$(SIGNING_KEY_PATH)" ]; then \
			echo "Missing SIGNING_KEY_PATH private key file"; \
			exit 1; \
		fi; \
		openssl dgst -sha256 -sign "$(SIGNING_KEY_PATH)" -out "$(RELEASE_DIR)/$(DAEMON_BIN).sig" "$(RELEASE_DIR)/$(DAEMON_BIN)"; \
		openssl dgst -sha256 -sign "$(SIGNING_KEY_PATH)" -out "$(RELEASE_DIR)/$(LICENSEGEN_BIN).sig" "$(RELEASE_DIR)/$(LICENSEGEN_BIN)"; \
		openssl pkey -in "$(SIGNING_KEY_PATH)" -pubout -out "$(RELEASE_DIR)/signing_public.pem"; \
	fi

release-host: ui-build daemon-test
	rm -rf $(RELEASE_DIR)
	mkdir -p $(RELEASE_DIR)/ui
	cp -R ui/dist $(RELEASE_DIR)/ui/dist
	$(MAKE) daemon-build VERSION=$(VERSION) GOOS=$(GOOS) GOARCH=$(GOARCH)
	$(MAKE) licensegen-build VERSION=$(VERSION) GOOS=$(GOOS) GOARCH=$(GOARCH)
	$(MAKE) sign-artifacts VERSION=$(VERSION) GOOS=$(GOOS) GOARCH=$(GOARCH) SIGNING_REQUIRED=$(SIGNING_REQUIRED) SIGNING_KEY_PATH=$(SIGNING_KEY_PATH)
	cp daemon/README.md $(RELEASE_DIR)/README-daemon.md
	( cd $(RELEASE_DIR) && find . -type f ! -name checksums.txt | LC_ALL=C sort | xargs shasum -a 256 > checksums.txt )
	@echo "Release bundle ready: $(RELEASE_DIR)"

release-signed:
	$(MAKE) release-host VERSION=$(VERSION) GOOS=$(GOOS) GOARCH=$(GOARCH) SIGNING_REQUIRED=1 SIGNING_KEY_PATH=$(SIGNING_KEY_PATH)

release-all:
	@for target in $(RELEASE_TARGETS); do \
		goos=$${target%/*}; \
		goarch=$${target#*/}; \
		echo "==> Building $$goos/$$goarch"; \
		$(MAKE) release-host VERSION=$(VERSION) GOOS=$$goos GOARCH=$$goarch SIGNING_REQUIRED=$(SIGNING_REQUIRED) SIGNING_KEY_PATH=$(SIGNING_KEY_PATH) || exit 1; \
	done

release-matrix:
	$(MAKE) release-all VERSION=$(VERSION) RELEASE_TARGETS="$(RELEASE_MATRIX_TARGETS)" SIGNING_REQUIRED=$(SIGNING_REQUIRED) SIGNING_KEY_PATH=$(SIGNING_KEY_PATH)

release: release-host

package-macos-dmg:
	VERSION=$(VERSION) GOARCH=arm64 OUTPUT_DMG=dist/release/$(VERSION)-darwin-arm64/cronye-macos.dmg ./scripts/package-macos-dmg.sh
