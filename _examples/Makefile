.PHONY: all generate diff

all: generate diff

generate:
	webrpc-gen -schema=./node-ts/service.ridl -target=../ -Client -out=./node-ts/webapp/client.gen.ts
	webrpc-gen -schema=./node-ts/service.ridl -target=../ -Server -out=./node-ts/server/server.gen.ts

diff:
	git diff --color --ignore-all-space --ignore-blank-lines --exit-code .
