# Contributing to ensemble-weather

Thanks for helping. This SDK follows the shared
[SDK standard](spec/SDK-STANDARD.md) and [behaviour spec](spec/BEHAVIOR.md)
(pinned in `spec/`). Behaviour is fixed there and by the shared vectors; this
repository only expresses it in idiomatic TypeScript.

## Setup

Node.js 22 or newer for development (the package itself supports Node.js 18+).

```sh
npm ci
```

## The checks

Every one of these runs in CI and must pass before a merge:

```sh
npm run format:check         # prettier
npm run lint                 # eslint: typescript-eslint strict-type-checked + eslint-plugin-security
npm run typecheck            # tsc --noEmit, strict, includes the generated spec checks
npm test                     # vitest: unit tests, the 43 shared vectors, spec drift
npm run build                # dual ESM + CommonJS build into dist/
npm run examples             # every example against a local mock of the API
npm run smoke                # the built package under Node (ESM, CJS), Deno and Bun
npm run check:package        # publint + @arethetypeswrong/cli
npm run docs                 # TypeDoc into docs/
node scripts/check-dependencies.mjs   # zero runtime dependencies
node scripts/gen-spec-checks.mjs --check
node scripts/sync-spec.mjs --check
```

`npm run check` runs format, lint, typecheck and tests together.

Tests and examples never call the real API: the vectors and unit tests use a
mock `fetch`, and the examples run against `scripts/mock-server.mjs`
(`node scripts/mock-server.mjs` serves it on port 8787; point an example at it
with `OUREA_BASE_URL=http://127.0.0.1:8787`).

## The pinned spec

`spec/` is a copy of
[ensemble-weather-spec](https://github.com/Ourea-Technologies/ensemble-weather-spec)
at the commit or tag in `spec/VERSION`. Do not edit it by hand:

```sh
node scripts/sync-spec.mjs <ref>      # pin a new ref and copy it
node scripts/gen-spec-checks.mjs      # regenerate the model drift checks
```

Set `OUREA_SPEC_REPO` to a local clone to sync from it.

## Dependencies

### Runtime dependencies

None. The SDK uses the platform's `fetch`, `JSON`, `URL` and streams, and CI
fails (`scripts/check-dependencies.mjs`) if `dependencies`,
`optionalDependencies`, `peerDependencies` or `bundleDependencies` gain an
entry. Adding one needs a justification line here and Harrison's approval
first. The list, as `- \`name\`: why`:

<!-- runtime-dependencies:start -->
<!-- runtime-dependencies:end -->

### Development dependencies

Pinned exactly in `package.json` and locked by `package-lock.json`.

- `typescript`: the compiler and the dual build.
- `eslint`, `@eslint/js`, `typescript-eslint`, `globals`: lint at the strict-type-checked level.
- `eslint-plugin-security`: the static security lint SDK-STANDARD requires.
- `prettier`: formatting.
- `vitest`, `@vitest/coverage-v8`: tests and coverage (vitest 3 still runs on Node.js 18).
- `typedoc`: the API reference.
- `publint`, `@arethetypeswrong/cli`: check the published package shape and its types.
- `yaml`: read the pinned OpenAPI spec in the drift test and the check generator.
- `@types/node`: types for tests and scripts (the package's own types need none).

## Commits and pull requests

- One logical change per commit, with an imperative summary line and a short
  body saying what and why.
- `main` is protected and linear: rebase, do not merge.
- A behaviour change starts in ensemble-weather-spec (with its vectors), then
  lands here by bumping `spec/VERSION`.
- Update `CHANGELOG.md` under "Unreleased".

## Releasing

Bump `version` in `package.json` and `src/version.ts`, move the changelog
entries under the new version, and push a `vX.Y.Z` tag on `main`.
`release.yml` builds, tests and publishes to npm with provenance through
trusted publishing (OIDC), then creates the GitHub release.
