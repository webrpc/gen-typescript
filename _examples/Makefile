.PHONY: all generate diff

all: generate diff

generate:
	webrpc-gen -schema=./hello-webrpc-ts/hello-api.ridl -target=../ -extra=noexports -client -out=./hello-webrpc-ts/webapp/client.gen.ts
	webrpc-gen -schema=./hello-webrpc-ts/hello-api.ridl -target=../ -extra=noexports -server -out=./hello-webrpc-ts/server/hello_api.gen.ts
	webrpc-gen -schema=./node-ts/service.ridl -target=../ -extra=noexports -client -out=./node-ts/webapp/client.gen.ts
	webrpc-gen -schema=./node-ts/service.ridl -target=../ -extra=noexports -server -out=./node-ts/server/server.gen.ts

diff:
	git diff --color --ignore-all-space --ignore-blank-lines --exit-code .
