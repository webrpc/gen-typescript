.PHONY: all generate diff

all: generate diff

generate:
	cd node-ts && make generate
	cd sse && make generate
	# Strip webrpc-gen version from generated files to avoid git conflicts.
	@VERSION=$$(webrpc-gen --version | awk '{print $$2}'); \
	if [ -n "$$VERSION" ] && [ "$$VERSION" != "unknown" ]; then \
		git grep -l "$$VERSION" -- '*.ts' | xargs sed -i "s/@$$VERSION//g"; \
	fi

diff:
	git diff --color --ignore-all-space --ignore-blank-lines --exit-code .
