VERSION ?= v0.8.3
PORT = 9988

define test
	webrpc-test -print-schema > ./tests/api.ridl
	webrpc-gen -schema=$(shell pwd)/tests/api.ridl -target=typescript -client -out=$(shell pwd)/tests/client.ts
	webrpc-test -server -port $(PORT) -timeout=5s &
	until nc -z localhost $(PORT); do sleep 0.2; done;
	cd tests && PORT=$(PORT) npm run test
endef

test-ci:
	mkdir -p bin
	export PATH=$PATH:$(shell pwd)/bin
	curl -L -o ./bin/webrpc-test https://github.com/webrpc/webrpc/releases/download/$(VERSION)/webrpc-test.linux-amd64
	curl -L -o ./bin/webrpc https://github.com/webrpc/webrpc/releases/download/$(VERSION)/webrpc-gen.linux-amd64
	cd tests && npm install
	$(call test)

test:
	$(call test)
