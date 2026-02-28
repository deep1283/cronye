.PHONY: run build test fmt

run:
	go run ./cmd/daemon

build:
	go build ./...

test:
	go test ./...

fmt:
	gofmt -w ./cmd ./internal
