webrpc-gen Typescript templates
===============================

This repo contains the templates used by the `webrpc-gen` cli to code-generate
webrpc Typescript server and client code.

This generator, from a webrpc schema/design file will code-generate:

1. Client -- an isomorphic/universal Typescript client to speak to a webrpc server using the
provided schema. This client is compatible with any webrpc server language (ie. Go, nodejs, etc.).
As the client is isomorphic, means you can use this within a Web browser or use the client in a 
server like nodejs -- both without needing any dependencies. I suggest to read the generated TS
output of the generated code, and you shall see, its nothing fancy, just the sort of thing you'd
write by hand.

2. Server -- a nodejs Typescript server handler. See examples.

## Features

### Query Keys for React Query / SWR / RTK Query

The generated client includes a `queryKey` property with type-safe query key generators for each endpoint. This makes it easy to use with popular data-fetching libraries:

```typescript
import { useQuery } from '@tanstack/react-query'
import { Example } from './client.gen'

const client = new Example('http://localhost:3000', fetch)

function UserProfile({ userId }) {
  const { data } = useQuery({
    queryKey: client.queryKey.getUser({ userId }),
    queryFn: ({ signal }) => client.getUser({ userId }, undefined, signal)
  })
  
  return <div>{data?.user.name}</div>
}
```

The query keys follow the pattern `[ServiceName, methodName, request?]` and are fully type-safe with `as const` assertions.

## Usage

```
webrpc-gen -schema=example.ridl -target=typescript -server -client -out=./example.gen.ts
```

or 

```
webrpc-gen -schema=example.ridl -target=github.com/webrpc/gen-typescript@v0.7.0 -server -client -out=./example.gen.ts
```

or

```
webrpc-gen -schema=example.ridl -target=./local-templates-on-disk -server -client -out=./example.gen.ts
```

As you can see, the `-target` supports default `typescript`, any git URI, or a local folder :)

### Set custom template variables
Change any of the following values by passing `-option="Value"` CLI flag to `webrpc-gen`.

| webrpc-gen -option | Description          | Default value                                     | Version |
|--------------------|----------------------|---------------------------------------------------|---------|
| `-client`          | generate client code | unset (`false`)                                   | v0.0.1  |
| `-server`          | generate server code | unset (`false`)                                   | v0.0.1  | 
| `-webrpcHeader`    | `true`               | enable client send webrpc version in http headers | v0.15.0 |

## LICENSE

[MIT LICENSE](./LICENSE)
