.PHONY: run build test fmt

run:
	@set -a; [ -f .env.local ] && . ./.env.local; set +a; go run ./cmd/daemon

build:
	go build ./...

test:
	go test ./...

fmt:
	gofmt -w ./cmd ./internal
