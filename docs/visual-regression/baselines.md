# Visual-Regression Baselines

This is the operator's guide for the committed snapshot baselines that power
`CINDER_VISUAL_DIFF=block`. The infrastructure (capture modes, coverage check,
determinism gate, CI dispatch) ships in `packages/testing`; this document
covers how baselines are authored, where they live, and how block mode behaves.

For the read-only discovery that gated this work — baseline-size projection,
ID-stability inventory, fixture conventions, `data-testid` policy — see
[`phase-0-inventory.md`](./phase-0-inventory.md).

## The three modes

`captureScreenshot` (in `packages/testing/src/helpers/screenshot.ts`) branches on
the `CINDER_VISUAL_DIFF` environment variable:

- **`off`** (default): writes a PNG to `packages/testing/screenshots/<slug>/` for
  human review. No pixel comparison. `screenshots/` is gitignored.
- **`report`**: non-blocking comparison against the committed baseline. A mismatch
  is recorded as a JSON fragment plus a diff PNG and surfaced in the CI job
  summary; the test never throws. Used during soak.
- **`block`**: `expect(page).toHaveScreenshot(...)` against the committed baseline.
  Any difference beyond tolerance fails the test immediately. This is the gate.

The diff tolerance is `maxDiffPixels: 2` at `threshold: 0.1`, declared once in
`screenshot.ts` and mirrored in `playwright.config.ts`.

## Where baselines live

```
packages/testing/snapshots/<slug>/<theme>-<viewport>-<fixture>.png
```

Unlike `screenshots/`, the `snapshots/` directory is **committed** — it is not in
`.gitignore`. The full matrix per component is two themes (`light`, `dark`) times
three viewports (`mobile` 375px, `tablet` 768px, `desktop` 1280px — all 900px
tall) times each fixture (or a synthesised `default` fixture when a component
declares none). That is six images per fixture.

`scripts/baseline-coverage-check.ts` enumerates every
`slug × theme × viewport × fixture` from the manifest and fails with a named list
when any baseline is absent. CI runs it whenever diffing is active (report or
block), so a new component added without baselines is caught in one place rather
than as scattered per-test failures.

## Why baselines are authored only in Docker

Pixel output is environment-sensitive: font hinting, anti-aliasing, and the
rasterizer all vary by OS, architecture, and browser build. A baseline authored
on a macOS or Apple-Silicon dev host will not match the pixels CI produces on
`ubuntu-latest`, and with a 2-pixel tolerance that divergence reads as a spurious
regression. The codebase has no bundled font — it uses system fonts via CSS
variables — so there is nothing to pin except the rendering environment itself.

The single source of truth for that environment is the canonical
**`cinder-playwright`** Docker image (`packages/testing/Dockerfile`): the official
`mcr.microsoft.com/playwright:v<version>-jammy` base (Ubuntu 22.04 "jammy") with
Bun installed and the exact-pinned Playwright version baked in as
`CINDER_PLAYWRIGHT_VERSION`. CI's `ubuntu-latest` runner is the matching native
amd64 target.

`scripts/docker-authenticity.ts` enforces this: `test:browser:update` refuses to
write baselines unless three checks pass — `/etc/os-release` codename is `jammy`,
the installed Playwright version matches the `package.json` pin, and
`CINDER_PLAYWRIGHT_VERSION` was baked at image build. Run it on a bare dev host
and it exits non-zero with instructions to use the Docker path instead. This is
intentional: it is the guard that keeps flaky, host-authored pixels out of the
committed set.

> [!WARNING]
> Do not run `test:browser:update` directly on macOS, Apple Silicon, or any
> non-`jammy` host, and do not author baselines under QEMU emulation of the amd64
> image — emulated pixels diverge from native amd64 CI just as much as a foreign
> host would. The authenticity gate will stop the direct path; the emulation path
> is yours to avoid.

## Authoring or updating baselines

### Locally, via the Docker wrapper

```bash
bun run --filter=@cinder/testing test:browser:update:docker
```

`scripts/update-snapshots-docker.ts` derives the image tag from the pinned
Playwright version, builds the image from `packages/testing/Dockerfile`, mounts
the repo, and runs `test:browser:update` inside the container with
`CINDER_VISUAL_DIFF=block` and `--update-snapshots --retries=0`. Requires a
working Docker daemon on an amd64 host (or native amd64 Linux). Commit the
resulting PNGs under `packages/testing/snapshots/`.

### In CI, via workflow dispatch (preferred)

The `update-baselines` job in `.github/workflows/browser-tests.yaml` is the
preferred path because it runs on the native amd64 GitHub runner. Trigger the
`browser-tests` workflow with `workflow_dispatch`, set `update_baselines=true`,
and provide `source_ref` (the branch to render from) and `base_ref` (the branch
the snapshot PR targets). The job builds the canonical image, writes baselines,
and opens a **snapshot-only follow-up PR** so the PNG churn lands separately from
the source change.

### Scope the set you regenerate

PNG blobs are non-deltifiable, so every rewrite adds a full copy to history. Keep
the initial and per-change baseline sets small — start with the components a PR
actually touches rather than the full matrix. Pass a `--grep` filter through the
update command to scope it, e.g.:

```bash
bun run --filter=@cinder/testing test:browser:update:docker -- --grep "Button"
```

The phase-0 projection put the full initial set at ~18.8 MB and 12-month growth
at ~154 MB — under the 200 MB threshold for plain Git, so no LFS is needed, but
that headroom assumes disciplined scoping.

## How block mode behaves on a clean checkout

When `snapshots/` has no baseline for a case, block mode does not fall through to
Playwright's generic "A snapshot doesn't exist" message. `blockBaselineGuard`
(in `screenshot.ts`) fails the test with an actionable message naming the missing
file and pointing at the update workflow above. The guard stays silent during an
`--update-snapshots` run, so authoring still works — `toHaveScreenshot` writes the
new baseline as expected.

Therefore, on a clean checkout:

- With baselines committed for a case: `CINDER_VISUAL_DIFF=block bun run test:browser`
  passes when pixels match and fails when they differ — that is the regression gate.
- With no baseline committed for a case: the run fails fast with the
  "author baselines via Docker" message rather than a confusing default.

## What the gate's comparison contract guarantees (and what it does not yet)

The "passes on match / catches a change" half of block mode is pinned by
`src/helpers/screenshot-block-comparison.test.ts`. It runs `pixelmatch` at the
exact `threshold`/`maxDiffPixels` from `SNAPSHOT_DIFF_OPTIONS` against a small,
committed, deterministically-generated baseline fixture under
`src/helpers/__fixtures__/`, proving an identical render passes, a sub-threshold
change still passes, and an obvious change is caught — the same
pixelmatch-over-committed-PNG approach `determinism-check.test.ts` uses. That
fixture is **not** a component baseline and deliberately does **not** live under
`snapshots/`: a synthetic image must never be diffed against real
browser-rendered component pixels.

The remaining half — committing authentic per-component baselines and running a
green `toHaveScreenshot` browser pass against them — is not done here. Authentic
pixels can only be authored on native amd64 inside the canonical
`cinder-playwright` Docker image (the authenticity gate refuses anything else,
and QEMU pixels are flaky). Produce them via the `update-baselines` CI dispatch
described above, which lands them in a snapshot-only PR; only then can a real
browser block-mode run be shown green on a clean checkout.

## Flipping CI to block

CI defaults to `CINDER_VISUAL_DIFF=off`. The rollout is `off` → `report` (soak,
review the job-summary diffs) → `block`. Flipping to `block` is the single-line
change to the workflow's `CINDER_VISUAL_DIFF` default, and it is only safe once a
committed baseline set exists for the components in scope — otherwise the
`blockBaselineGuard` message fires for every uncovered case.
