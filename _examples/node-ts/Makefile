all:
	@awk -F'[ :]' '!/^all:/ && /^([A-z_-]+):/ {print "make " $$1}' Makefile

bootstrap:
	rm -rf server/node_modules && rm -rf webapp/node_modules
	cd server && pnpm install
	cd webapp && pnpm install

generate:
	webrpc-gen -schema=service.ridl -target=../../../gen-typescript -server -out=./server/server.gen.ts
	webrpc-gen -schema=service.ridl -target=../../../gen-typescript -client -out=./webapp/client.gen.ts

run-server:
	cd ./server && pnpm start

run-client:
	cd ./webapp && pnpm start
