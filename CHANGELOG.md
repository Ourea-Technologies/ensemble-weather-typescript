# Changelog

All notable changes to this package are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the package uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-10-26

### Added

- `Ourea`, the client for API v1 (contract 1.0.0): every operation except
  `getMapsToken`, each taking `{ signal }`.
- Probability terms (`atLeast`, `atMost`) and window totals (`windowTotal`),
  computed server-side, returned in the caller's order with their reference
  class; thresholds in any unit (`inches`, `fahrenheit`, ...) converted exactly.
- Hand-written, camelCase models for every response schema, with open enums.
- Canonical request URLs, keyless open routes, same-host redirects, retries
  with `Retry-After` and full-jitter backoff, an ETag cache on by default,
  deprecation warnings, rate-limit state on every result.
- Typed errors under `OureaError`, one class per category.
- ESM and CommonJS builds with types for both; zero runtime dependencies;
  Node.js 18+, browsers, Deno, Bun and Cloudflare Workers.

[Unreleased]: https://github.com/Ourea-Technologies/ensemble-weather-typescript/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Ourea-Technologies/ensemble-weather-typescript/releases/tag/v0.1.0
