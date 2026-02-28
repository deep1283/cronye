.PHONY: ui-build daemon-test daemon-build release

VERSION ?= dev
GOOS ?= $(shell cd daemon && go env GOOS)
GOARCH ?= $(shell cd daemon && go env GOARCH)
GO_CACHE_DIR ?= $(abspath daemon/.cache/go-build)
GO_MOD_CACHE_DIR ?= $(abspath daemon/.cache/gomod)

RELEASE_DIR := dist/release/$(VERSION)-$(GOOS)-$(GOARCH)
DAEMON_BIN := cronye-daemon

ifeq ($(GOOS),windows)
DAEMON_BIN := cronye-daemon.exe
endif

ui-build:
	cd ui && npm run build

daemon-test:
	cd daemon && GOCACHE=$(GO_CACHE_DIR) GOMODCACHE=$(GO_MOD_CACHE_DIR) go test ./...

daemon-build:
	cd daemon && GOCACHE=$(GO_CACHE_DIR) GOMODCACHE=$(GO_MOD_CACHE_DIR) CGO_ENABLED=1 GOOS=$(GOOS) GOARCH=$(GOARCH) go build -ldflags "-X github.com/cronye/daemon/internal/version.BuildVersion=$(VERSION)" -o ../$(RELEASE_DIR)/$(DAEMON_BIN) ./cmd/daemon

release: ui-build daemon-test
	rm -rf $(RELEASE_DIR)
	mkdir -p $(RELEASE_DIR)/ui
	cp -R ui/dist $(RELEASE_DIR)/ui/dist
	$(MAKE) daemon-build VERSION=$(VERSION) GOOS=$(GOOS) GOARCH=$(GOARCH)
	cp daemon/README.md $(RELEASE_DIR)/README-daemon.md
	( cd $(RELEASE_DIR) && shasum -a 256 $(DAEMON_BIN) > checksums.txt )
	@echo "Release bundle ready: $(RELEASE_DIR)"
