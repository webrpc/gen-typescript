.PHONY: all generate diff

all: generate diff

generate:
	cd node-ts && make generate
	cd sse && make generate

diff:
	git diff --color --ignore-all-space --ignore-blank-lines --exit-code .
