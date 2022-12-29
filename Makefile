PORT = 9988

test:
	webrpc-test -print-schema > ./tests/api.ridl
	webrpc-gen -schema=$(shell pwd)/tests/api.ridl -target=typescript -client -out=$(shell pwd)/tests/client.ts
	webrpc-test -server -port $(PORT) -timeout=5s &
	until nc -z localhost $(PORT); do sleep 0.2; done;
	cd tests && PORT=$(PORT) npm run test
