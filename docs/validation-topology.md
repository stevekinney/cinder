# Validation topology

Cinder validates the same source tree at five layers: local commit, local
push, pull-request CI, post-merge main-green, and release. Each layer exists
to catch a specific class of problem as cheaply as possible — running the
full suite at every layer would make commits and pushes unusably slow;
running nothing until release would let broken code merge. This document is
the map of what each layer runs, what it deliberately skips, and why the
boundary sits where it does.

## The layers

| Layer                                                                       | What it runs                                                                                                                                                                                                                                                                                                                                                                                                                                       | What it deliberately does NOT run                                                                                                                 | Rationale                                                                                                                                                                                                                                                                                                     |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Commit** (`pre-commit`)                                                   | Lockfile-sync check, `lint-staged` (formatters + oxlint on staged files), scoped per-package `typecheck`                                                                                                                                                                                                                                                                                                                                           | Tests (any kind), the full `lint`/`lint:invariants` chains, stylelint                                                                             | Fast formatting + type feedback. Tests are not run locally at all anymore (neither commit nor push) — PR CI and `main-green` own every test run, so commit stays a sub-second lockfile+lint+typecheck pass.                                                                                                   |
| **Push** (`pre-push`)                                                       | Fast, fail-open sanity checks only: parses the push-ref list off stdin to skip deletion-only pushes, and prints a best-effort, non-blocking changeset-presence hint for published-package source changes                                                                                                                                                                                                                                           | Any lint/typecheck/test dispatch, any package build, and the local gate lock that used to serialize concurrent worktree pushes behind one another | Deliberately inverted from the old design. Every check here warns, never blocks — there is nothing left in this hook that can fail a push. See "The push-layer inversion" below.                                                                                                                              |
| **PR CI** (`unit-tests.yaml`, `browser-tests.yaml`, `changeset-guard.yaml`) | Scoped unit tests (`test:changed`) plus whole-repo invariants that a diff-scoped run could miss (`aggregator:check`, `components:check`), an unconditional `lint`/`lint:invariants` sweep, dependency-scoped browser tests, and a fast standalone changeset-bump guard                                                                                                                                                                             | The authoritative full source suite, consumer/tarball publish validation                                                                          | Fast, dependable per-PR feedback. Whole-repo invariants run unconditionally because a source change can desync a generated artifact without touching the artifact's own checker (`test:changed` would miss that).                                                                                             |
| **main-green** (post-merge, nightly)                                        | Workspace `lint` + `lint:invariants`, workspace `typecheck`, generated artifact checks (`aggregator:check`, `components:check`), source audits (`check:placeholder-docs`, workflow validation, Svelte peer validation, `platform:audit`, `colors:audit`, `tokens:audit`), the FULL component suite through chunked `test:changed`, full component coverage via `test:coverage`, non-component workspace tests, plus the non-blocking memory canary | Consumer/tarball publish validation (`validate:consumer`, `package:weight:check`)                                                                 | The authoritative source-validation gate. Push runs are keyed by SHA and are not cancelled by newer pushes because release waits for the same-SHA run before publishing. If this goes red, the class of bug PR CI's scoping missed is presumed to have leaked.                                                |
| **Release** (`release.yaml`)                                                | Changeset policy guards on every push; on the actual publish path, Chromium install, `validate:consumer`, a same-SHA `main-green` wait, `package:weight:check`, and `publish:release --skip-validation` against the already staged tarball; on dry-run, Chromium install, `validate:consumer`, `package:weight:check`, and `publish:release --dry-run --skip-validation`                                                                           | Full source validation (`lint`, `typecheck`, coverage, source audits, generated-artifact checks)                                                  | Release is an artifact gate, not another source-validation runner. `validate:consumer` installs the packed tarball into fixture apps and package weight checks the same artifact immediately before publish. Pending-changesets pushes still skip artifact work and only open/update the Version Packages PR. |

## The push-layer inversion

Pre-push used to run a scoped (or, on any scope-derivation ambiguity, full)
`lint`+`typecheck`+`test` pass before every push, serialized across every
worktree on the machine behind a shared gate lock
(`withLocalValidationGateLock` in `packages/components/scripts/husky/utilities.ts`).
The design philosophy was **fail safe to full on any ambiguity**: a missed
edge in the scope-derivation logic could never let an untested change slip
past the local gate. That correctness story was bought with a latency tax
that grows linearly with the number of concurrent worktrees — a fleet of
agents pushing at once queued behind one gate lock, each potentially paying
for a full workspace validation before their push completed.

Pre-push now inverts that trade. It **fails open**: every check it runs only
warns and the hook always exits `0` — there is no scoped or full
lint/typecheck/test dispatch, no package build, and no gate lock left to
serialize on (see "Gate lock" below for what still uses that lock). The
backstop moved to PR CI and required branch-protection status checks: a PR
whose changes break something is caught there, in parallel, without blocking
every other worktree's push. Breakage on a PR branch is cheap to catch and
fix; a serialized local gate across N concurrent worktree agents is not.

### Removed check → CI-owner mapping

Every check pre-push used to run locally is still enforced — just moved
entirely into CI, where it can run in parallel instead of serialized behind
one lock:

| Removed from pre-push                                                                                                                                                                                         | Now enforced by                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Scoped `lint` (oxlint) over the touched-package closure                                                                                                                                                       | `unit-tests.yaml` (`turbo run lint`, unconditional) and `main-green`                                                                                                                                                                                                                                                                       |
| Scoped `typecheck` over the reverse-dependency closure                                                                                                                                                        | `browser-tests.yaml`'s dedicated `typecheck` job (fresh checkout) and `main-green`                                                                                                                                                                                                                                                         |
| Scoped `test`/`test:changed` over the reverse-dependency closure — `@lostgradient/cinder`/`@lostgradient/chat`                                                                                                | `unit-tests.yaml`'s scoped `test:changed` job and `main-green`'s full `test:changed` chunk matrix                                                                                                                                                                                                                                          |
| Scoped `test` over the reverse-dependency closure — `@cinder/diff`/`@cinder/markdown`/`@cinder/commentary` (bundled into cinder, published nowhere on their own; previously had no CI test step of their own) | `unit-tests.yaml`'s `turbo run test --filter='@cinder/diff...[origin/<base>...HEAD]' --filter='@cinder/markdown...[origin/<base>...HEAD]' --filter='@cinder/commentary...[origin/<base>...HEAD]'` step (git-range scoped per package, deliberately not `--affected`, which would union in every other affected workspace) and `main-green` |
| `stylelint` over changed CSS/Svelte files                                                                                                                                                                     | `unit-tests.yaml` (`bunx stylelint`, unconditional) and `main-green`                                                                                                                                                                                                                                                                       |
| The buildable-dependency-closure pre-build (issue #364 fix)                                                                                                                                                   | Each CI job's own `--filter` build step, hash-skipped by `build-cache.ts` exactly as before                                                                                                                                                                                                                                                |
| The local gate lock serializing concurrent worktree pushes                                                                                                                                                    | Nothing needs to — CI runners are already isolated per job                                                                                                                                                                                                                                                                                 |

### Branch protection replaces the removed local safety net

`main` has required status checks configured via the GitHub branch-protection
API (not a workflow file): **`unit-tests`**, **`typecheck`**, **`playwright`**,
and **`Pre-1.0 changeset bump guard`**. `strict` is deliberately `false` — PRs
are **not** required to be up to date with `main` before merging. Requiring
strict-mode would reserialize merges behind a single up-to-date branch, which
is exactly the concurrency problem this change removes from pre-push, just
moved to the merge queue instead of the push path. The accepted residual risk
is a stale-base merge landing a real conflict-of-behavior on `main`; that
class of bug is caught post-hoc by `main-green` (the authoritative, unscoped
source gate), and `release.yaml` waits for a same-SHA `main-green` run before
publishing, so it cannot ship un-caught. No human review is required — agents
self-merge by design in this repository once their own PR's checks are green.

Required status checks have a sharp edge with path-filtered workflows: a PR
whose changed files match none of a required check's trigger paths leaves
that check permanently "Expected" and the PR unmergeable. `unit-tests.yaml`'s
and `changeset-guard.yaml`'s `pull_request` path filters were removed
entirely so they always run — both are cheap enough to afford unconditionally.

`browser-tests.yaml` is not cheap (Chromium install, a full Playwright run),
so it keeps the equivalent filtering but moves it from the workflow trigger
into the `scope` job, as a computed `relevant` output — `typecheck` and
`playwright` gate on `needs.scope.outputs.relevant` via `if:` instead of an
`on.pull_request.paths` list. The `scope` job derives `relevant` in code
(a bash reimplementation of the same last-match-wins path-pattern algorithm
the removed `paths:` filter used, failing SAFE to `relevant=true` on any
error deriving the diff), so a PR whose diff doesn't touch anything
browser-test-relevant still triggers the workflow but skips the two
expensive jobs.

This works because of one specific GitHub behavior: a job skipped via `if:`
reports conclusion `"skipped"`, and GitHub treats a skipped check run as
satisfying a required status check — it does not block merging and does not
leave the check stuck "Expected". So every PR reports both required names
(`typecheck`, `playwright`) exactly once, from exactly one workflow, whether
skipped or run for real.

An earlier version of this used a second workflow (`browser-tests-skip.yaml`)
mirroring `browser-tests.yaml`'s trigger paths and reporting the same two
job names on the logical inverse path set, so at least one of the two
workflows would always report each name. That was the wrong call: GitHub's
own docs warn that "using the same job name in multiple workflows can cause
ambiguous status check results and block pull requests from being merged" —
and that's exactly what happened in practice on the PR that introduced this
topology: every individual check run showed `success`, but the pull
request's merge state stayed `blocked` until the duplicate-named workflow
was replaced with the single-workflow, `if:`-gated pattern described above.

## The guardrails

Six mechanisms exist specifically to keep this topology honest — to stop
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
- **Gate lock** (`withLocalValidationGateLock` in
  `packages/components/scripts/husky/utilities.ts`) — serializes expensive,
  disk-mutating local work across worktrees sharing one machine. Pre-push no
  longer holds it (it has no expensive critical section left); it remains for
  the scripts that still do heavy work standalone outside of CI —
  `test-changed.ts`, `generate-component-artifacts.ts`
  (`components:generate`/`components:check`), and `validate-consumers.ts`
  (`validate:consumer`) — so concurrent worktrees don't stack full test runs,
  artifact generation, or tarball installs on top of one another. A waiter
  keeps polling while the lock's recorded PID is alive, regardless of the
  lock's age; dead holders are reclaimed immediately, while malformed locks
  retain a bounded grace period and wait before the command fails.
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
