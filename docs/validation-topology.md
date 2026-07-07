# Validation topology

Cinder validates the same source tree at five layers: local commit, local
push, pull-request CI, post-merge main-green, and release. Each layer exists
to catch a specific class of problem as cheaply as possible — running the
full suite at every layer would make commits and pushes unusably slow;
running nothing until release would let broken code merge. This document is
the map of what each layer runs, what it deliberately skips, and why the
boundary sits where it does.

## The layers

| Layer                                                                       | What it runs                                                                                                                                                                                                                                                                      | What it deliberately does NOT run                                                                                                       | Rationale                                                                                                                                                                                                                                                                                               |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Commit** (`pre-commit`)                                                   | Lockfile-sync check, `lint-staged` (formatters + oxlint on staged files), scoped per-package `typecheck`                                                                                                                                                                          | Tests (any kind), the full `lint`/`lint:invariants` chains, stylelint                                                                   | Fast formatting + type feedback. Tests belong to push, where a scoped dependency-closure run is cheap enough to afford but still catches real breakage before it leaves the machine.                                                                                                                    |
| **Push** (`pre-push`)                                                       | Scoped `lint`, `typecheck`, `test`/`test:changed` over the changed packages' reverse-dependency closure; stylelint on changed CSS/Svelte files; falls back to the full suite on any scope-derivation uncertainty                                                                  | The full unscoped suite (unless scope derivation fails or a root config file changed)                                                   | The last local gate before code leaves the machine. Scoped to the dependency closure so it stays fast, but fails safe to full on any ambiguity — a missed edge can never silently skip a test.                                                                                                          |
| **PR CI** (`unit-tests.yaml`, `browser-tests.yaml`, `changeset-guard.yaml`) | Scoped unit tests (`test:changed`) plus whole-repo invariants that a diff-scoped run could miss (`aggregator:check`, `components:check`), an unconditional `lint`/`lint:invariants` sweep, dependency-scoped browser tests, and a fast standalone changeset-bump guard            | The authoritative full test suite, `validate`'s consumer/tarball/audit steps                                                            | Fast, dependable per-PR feedback. Whole-repo invariants run unconditionally because a source change can desync a generated artifact without touching the artifact's own checker (`test:changed` would miss that). The heavy `validate` chain is deferred to release, where it actually gates something. |
| **main-green** (post-merge, nightly)                                        | Workspace `lint` + `lint:invariants`, workspace `typecheck`, the FULL `bun run test` (every package, unscoped), plus the non-blocking memory canary                                                                                                                               | `validate`'s consumer-fixture/tarball/audit steps (release-only)                                                                        | The authoritative full-suite gate. Runs post-merge (so it never blocks a PR) and nightly (so drift is caught even without a merge). If this goes red, the class of bug PR CI's scoping missed is presumed to have leaked.                                                                               |
| **Release** (`release.yaml`)                                                | The full `bun run validate` chain (lint, invariants, typecheck, coverage, `platform:audit`/`colors:audit`/`tokens:audit`, `aggregator:check`, `components:check`, workflow/svelte-peer validation, `validate:consumer`, `package:weight:check`) — only on the actual publish path | Re-running anything already covered by the PR that merged (the pending-changesets path is a no-op version-PR bump, not a re-validation) | Consumer/tarball validation is expensive (installs the packed tarball into fixture apps) and only matters when something is about to ship. Gating it on an actual pending publish means it never taxes a merge that isn't publishing.                                                                   |

## The guardrails

Five mechanisms exist specifically to keep this topology honest — to stop
regression back into "the same expensive check running four times, hooks
taking forever," and to catch the opposite failure, a gate silently missing
from the layer it needs to run in.

- **Pipeline coverage map** (`packages/components/scripts/check-pipeline-coverage.ts`,
  wired into `lint:invariants`) — a declarative table of every named validation
  command mapped to the layers it is supposed to run in. Parses the real
  workflow YAML (`run:` step bodies only, via `js-yaml`, so passing comments
  can never contaminate the result), the real `package.json` script chains
  (resolved transitively — a command doesn't have to be a literal workflow
  step to count as covered), and the two husky hook scripts (advisory only,
  by plain token search — the hooks are actively maintained separately and a
  parse failure there warns rather than fails). Fails on undeclared
  duplication or a silently dropped gate; this is the direct fix for issue
  #411 (`components:check` shipping in no workflow).
- **Memory canary** (`packages/components/scripts/memory-canary.ts`,
  `test:memory-canary`, wired as a non-blocking step in `main-green.yaml`) —
  runs a fixed representative slice of component suites and reports peak RSS.
  Exists to make memory trends visible, not to gate: it always exits 0 for the
  number itself (only a genuine test failure inside its own slice fails it),
  and the workflow step additionally sets `continue-on-error: true`.
- **Content-hash-skippable builds** (`packages/*/scripts/lib/build-cache.ts`) —
  each buildable package hashes its own inputs and skips rebuilding when the
  hash matches the last successful build. This is what makes the scoped
  push/PR layers affordable: a test job's inline `bun run --filter=<dep>
build` step becomes a near-instant no-op instead of a full rebuild when
  nothing upstream changed.
- **Global test cleanup** (`src/test/register-global-cleanup.ts`, loaded via
  `scripts/preload.ts`) — a single package-wide `afterEach(cleanup)` for every
  `@testing-library/svelte` render, replacing ad hoc per-file teardown. This
  is what keeps the full suite's peak RSS bounded across ~90+ test files
  sharing one process-global happy-dom `Window`.
- **Contract test** (coming separately) — a planned end-to-end assertion that
  a representative command actually produces the effect its layer expects
  (not just "the coverage map says it's declared"). Not yet implemented; noted
  here so its layer gets declared in `check-pipeline-coverage.ts` when it lands.

## The rule

**Adding a new validation command requires declaring its layer(s) in
`check-pipeline-coverage.ts`.** If a command is added to a workflow,
`package.json`, or a hook without a corresponding row in the declaration
table, it simply won't be checked — the coverage map only verifies commands
it knows about, by design (it is not an exhaustive "every script must be
declared" gate, which would make routine dev-only scripts a maintenance
burden). Add the row when the command graduates into being a real validation
gate, not before.
