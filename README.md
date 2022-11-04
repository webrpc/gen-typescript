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

## Usage

```
webrpc-gen -schema=example.ridl -target=typescript -Server -Client -out=./example.gen.ts
```

or 

```
webrpc-gen -schema=example.ridl -target=github.com/webrpc/gen-typescript@v0.7.0 -Server -Client -out=./example.gen.ts
```

or

```
webrpc-gen -schema=example.ridl -target=./local-templates-on-disk -Server -Client -out=./example.gen.ts
```

As you can see, the `-target` supports default `typescript`, any git URI, or a local folder :)

### Set custom template variables
Change any of the following values by passing `-Option="Value"` CLI flag to `webrpc-gen`.

| CLI option flag      | Description                | Default value              |
|----------------------|----------------------------|----------------------------|
| `-Client`            | generate client code       | unset (`false`)            |
| `-Server`            | generate server code       | unset (`false`)            |

## LICENSE

[MIT LICENSE](./LICENSE)
