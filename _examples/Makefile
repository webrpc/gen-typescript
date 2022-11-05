.PHONY: all generate diff

all: generate diff

generate:
	webrpc-gen -schema=./hello-webrpc-ts/hello-api.ridl -target=../ -Client -out=./hello-webrpc-ts/webapp/src/client.gen.ts
	webrpc-gen -schema=./hello-webrpc-ts/hello-api.ridl -target=golang -Pkg=main -Server -out=./hello-webrpc-ts/server/hello_api.gen.go
	webrpc-gen -schema=./node-ts/service.ridl -target=../ -Client -out=./node-ts/webapp/client.gen.ts
	webrpc-gen -schema=./node-ts/service.ridl -target=../ -Server -out=./node-ts/server/server.gen.ts

diff:
	git diff --color --ignore-all-space --ignore-blank-lines --exit-code .
