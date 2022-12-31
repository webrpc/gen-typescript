# Interoperability tests

This folder implements webrpc interoperability tests.

## Test matrix against webrpc-test reference binary

1. Generate code
2. Download webrpc binaries
3. Test generated client and server code against multiple versions of `webrpc-test` reference binaries via [test.sh](./test.sh) script

```bash
./download.sh v0.10.0 bin/v0.10.0
export PATH="$PWD/bin/v0.10.0:$PATH"
npm run test
```
