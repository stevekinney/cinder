# Vendored DTCG 2025.10 JSON Schemas

These two files are vendored (not fetched at test/build time) so `tokens:validate`
and `bun test packages/components/scripts/tokens` never depend on network access.

- `dtcg-format-2025-10.json`—retrieved from
  `https://www.designtokens.org/schemas/2025.10/format.json`
- `dtcg-resolver-2025-10.json`—retrieved from
  `https://www.designtokens.org/schemas/2025.10/resolver.json`

Retrieved: 2026-08-26, via `curl -sS <url> -o <file>`.

## `$schema` draft

Both files declare `"$schema": "http://json-schema.org/draft-07/schema#"`. Despite the
resolver schema being newer/more elaborate than the format schema, it is also draft-07—
there is no 2020-12 schema in this pair. `packages/components/scripts/tokens/validate-schema.ts`
therefore uses the plain `Ajv` export from `ajv` (draft-07 support is Ajv's default) for
_both_ validators. `Ajv2020` from `ajv/dist/2020` is not needed.

## These are single, self-contained files—the `format/*` and `resolver/*` sub-paths do not exist as separate endpoints

Both schemas reference URLs like `https://www.designtokens.org/schemas/2025.10/format/values/color.json`
via `$ref`. Those look like separate fetchable resources, but they are not: the DTCG site does not
serve those paths (fetching one returns the site's HTML 404 page, not JSON—confirmed by
attempting it). Every one of those `$ref` targets is actually a nested subschema _inlined inside
`format.json` and `resolver.json`_, each carrying its own `"$id"` that happens to match the
`$ref` URL. Registering the root schema with Ajv (`ajv.compile(schema)`) recursively registers
every nested `$id`, so `$ref` resolution works entirely offline. Do not try to fetch those
sub-paths individually—there is nothing there.

## `cinder.resolver.json` was migrated to the official object-keyed resolver shape

Cinder originally authored `packages/components/src/tokens/cinder.resolver.json` with **arrays**:
`sets: {name, source}[]`, `modifiers: {name, values, default?}[]`, `resolutionOrder: string[]`.
That shape declared the official `"$schema": ".../resolver.json"` URI but never actually conformed
to it—a real, confirmed divergence caught while building `validateResolverDocumentSchema`, not a
bug in the validator.

The official 2025.10 resolver schema requires **objects keyed by name**: `sets` is an object whose
values are `{ sources: [...] }` (note: `sources`, not `source`); `modifiers` is an object whose
values are `{ contexts: { <contextName>: sources[] }, default? }`; `resolutionOrder` is an array of
`{ "$ref": "#/sets/..." }` / `{ "$ref": "#/modifiers/..." }` reference objects (or inline
set/modifier definitions), not an array of plain modifier-name strings.

CIN-27 migrated the real `cinder.resolver.json` to this shape and rewrote
`scripts/tokens/types.ts` (`ResolverSet`, `ResolverModifier`, `ResolverDocument`,
`ResolverReference`), `scripts/tokens/validate.ts` (`validateResolverDocument`'s semantic checks),
and `scripts/tokens/validate-corpus.ts` (modifier-context binding now comes from the resolver's
`contexts` map, not from scanning each token document's `$extensions["com.lostgradient.cinder"].modifier`
marker) to match. `validateResolverDocumentSchema` is now wired into `assertValidResolverDocument`
as a first-pass gate, exactly like the format schema is for token documents—see that function's
doc comment in `validate.ts`. The token documents' `$extensions...modifier` markers are left in
place as now-dead metadata; they are not read by the toolchain anymore.

## A note on `$type` inheritance and the format schema

The format schema's per-type value discriminator keys off a token's _own_ `$type` property. A
token that relies on inherited `$type` (typed only by an ancestor group, with no local `$type`)
can produce ambiguous `oneOf` matches for value shapes that overlap with another type's shape—
observed empirically for `strokeStyle`'s bare-string form and for `typography`'s composite
`lineHeight` branch. Every document in the real corpus today uses only object-shaped
`color`/`dimension`/`duration` values relying on inherited `$type`, and none of those hit this
ambiguity (verified against every file under `src/tokens`). If a future token addition using a
type prone to this (e.g. `fontWeight`, `cubicBezier`, `number`, `strokeStyle`, or `typography`'s
composite `lineHeight`) trips a spurious schema failure while relying on inherited `$type`, add a
local `$type` to that token rather than weakening this gate.
