#!/bin/bash

export PORT=9988

webrpc-test -version
webrpc-test -print-schema > ./test.ridl
#webrpc-gen -schema=./test.ridl -target=typescript -client -out=./client.ts
webrpc-gen -schema=./test.ridl -target=../ -client -out=./client.ts

webrpc-test -server -port=$PORT -timeout=5s &

# Wait until http://localhost:$PORT is available, up to 10s.
for (( i=0; i<100; i++ )); do nc -z localhost $PORT && break || sleep 0.1; done

npm run vitest
