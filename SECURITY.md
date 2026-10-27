# Security policy

## Reporting a vulnerability

Please report vulnerabilities privately through GitHub's
[private vulnerability reporting](https://github.com/Ourea-Technologies/ensemble-weather-typescript/security/advisories/new)
for this repository. **Do not open a public issue**, pull request or
discussion for a security problem.

Include what you found, how to reproduce it, and the SDK version
(`VERSION` export or `package.json`). We aim to acknowledge a report within
three working days and will keep you informed until it is fixed and
released. We credit reporters who want it.

## Supported versions

Security fixes go into the latest 0.x release.

| Version | Supported |
| ------- | --------- |
| 0.1.x   | yes       |

## What the SDK guarantees

These are covered by tests (`test/unit/security.test.ts` and the shared
vectors):

- the API key never appears in errors, log lines, `toString`, `util.inspect`
  or JSON of the client, and is never sent as a query parameter;
- the key is never sent to another host on a redirect;
- TLS verification is never disabled, and there is no option to disable it;
- a response body over 64 MiB is an error, never an out-of-memory;
- JSON is parsed with `JSON.parse` into plain data only: no code is
  evaluated, no class instances are built, and a `__proto__` key cannot
  change an object's prototype;
- zero runtime dependencies.

Issues in the Ourea API itself (not this SDK) can be reported the same way.
