# Contributing to cinder

## Getting set up

```bash
bun install
bun run dev          # start the playground
bun test             # run all unit tests
bun run lint         # oxlint + stylelint
bun run typecheck
```

See [README.md](./README.md) for the consumer-facing API overview.

## Writing styles

### Use logical properties — cinder is RTL-aware

All component stylesheets must use CSS [logical properties][logical-properties] on the inline axis instead of physical `left`/`right` variants. This keeps the library usable in right-to-left writing modes without per-component overrides.

| Use this               | Instead of                                     |
| ---------------------- | ---------------------------------------------- |
| `margin-inline-start`  | `margin-left`                                  |
| `margin-inline-end`    | `margin-right`                                 |
| `margin-inline`        | `margin-left` + `margin-right`                 |
| `padding-inline-start` | `padding-left`                                 |
| `padding-inline-end`   | `padding-right`                                |
| `padding-inline`       | `padding-left` + `padding-right`               |
| `border-inline-start`  | `border-left`                                  |
| `border-inline-end`    | `border-right`                                 |
| `inset-inline-start`   | `left` (when positioning, but see note below)  |
| `inset-inline-end`     | `right` (when positioning, but see note below) |

Block-axis physical properties (`margin-top`, `padding-bottom`, `border-top`, `top`, `bottom`, `width`, `height`) are fine — they don't change under RTL.

Positioning properties (`left`, `right`) and `text-align: left | right` are **not** stylelint-enforced today. Many components position decorative or geometrically rotated elements (popover arrows, anchor positioning, fixed insets) where physical placement is intentional. When you add a new positioned element that should follow text direction, prefer `inset-inline-start` / `inset-inline-end` by hand. When you keep physical `left`/`right` (e.g., `data-placement="left"` selectors, rotated CSS-triangle decorations), it's worth a short comment so a future reader knows the choice was deliberate.

Stylelint enforces this on every CSS file and `<style>` block under `packages/*/src/**`. The pre-commit hook will auto-fix where it can and fail the commit otherwise. To run the check locally:

```bash
bun run lint        # full lint pipeline, including stylelint
bun run lint:fix    # auto-fix what's safe
```

When `left`/`right` carries semantic placement (e.g. `data-placement="left"` selectors on a tooltip), use the rule's `/* stylelint-disable-next-line csstools/use-logical */` escape hatch and add a comment explaining why the physical axis is intentional.

[logical-properties]: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_logical_properties_and_values

## Tests

- Unit tests use `bun:test` and live alongside the source as `*.test.ts`.
- Component browser tests live in `packages/testing` and run under Playwright (`bun run test:browser`).
- Every fix should land with a regression test.

### Visual regression

The Playwright sweep can compare each component screenshot against a committed baseline PNG. The mode is controlled by the `CINDER_VISUAL_DIFF` environment variable, surfaced as the `mode` input on the `browser-tests` workflow's manual dispatch:

- **`off`** (default) — screenshots are captured and uploaded as artifacts, but never compared. This is the current PR-gating default: visual diffs do not block PRs.
- **`report`** — screenshots are compared against baselines; mismatches are summarized in the job summary and a sticky PR comment, but the run still passes (soak mode).
- **`block`** — mismatches fail the job. **A missing baseline is a hard error in this mode**, so `block` cannot be enabled until a baseline set is committed.

> [!IMPORTANT]
> `block` mode is wired but **not yet active on PRs**, because no baselines are committed (`packages/testing/snapshots/` is empty). Flipping the PR-gating default to `block` before committing baselines would red every PR. Commit baselines first (below), then enable `block` in a single-line follow-up.

**When a visual change is intentional**, regenerate the baselines rather than fighting the diff:

1. Trigger the `browser-tests` workflow manually (`workflow_dispatch`) with `update_baselines=true`, `source_ref` set to your branch, and `base_ref` set to the branch the snapshot PR should target. The `update-baselines` job renders inside the canonical Playwright Docker image (so PNGs match CI byte-for-byte) and opens a snapshot-only follow-up PR.
2. Review and merge that snapshot PR alongside your change.

Locally, `bun run --filter='@cinder/testing' test:browser:update` regenerates baselines on your machine, but only the Docker-rendered PNGs from the workflow are authoritative for CI comparison — local PNGs differ by platform/font rendering and should not be committed.

### Coverage ratchet

`packages/components` enforces coverage floors through `packages/components/coverage-ratchet.json` and `packages/components/scripts/check-coverage-ratchet.ts`. The package `validate` script runs `test:coverage`, so the floor is checked in CI and in the pre-commit hook — a change that drops coverage below the floor fails the gate.

The floor is a **ratchet: it only ever moves up.** When you add tests that lift the real numbers, raise `lines` / `functions` in `coverage-ratchet.json` to the new measured floor in the same change. Never lower them to make a red gate pass — fix the missing coverage instead. To read the current numbers, run `bun run test:coverage` from `packages/components`; `lines` follows the file-weighted `All files` line coverage, and `functions` follows the LCOV aggregate function coverage.

## Main Branch Health

After `.github/workflows/main-green.yaml` lands on `main`, `main-green / workspace-gates` is the central default-branch signal for the same workspace gates developers run locally:

```bash
bun run lint
bun run typecheck
bun run test
```

If a local pre-push failure looks unrelated to your branch, check the latest `main-green / workspace-gates` run on `main` before spending time isolating your diff. A red `main-green` run means the failure is already present on the default branch; a green `main-green` run means you should keep debugging your branch.

This workflow runs on pushes to `main`, on a daily schedule, and by manual dispatch. It is a default-branch monitor, not a pull-request required check: this repository currently reports `Branch not protected` for `main`, and `main-green / workspace-gates` should not be configured as a required pull-request status unless a future change adds a `pull_request` trigger. To roll this monitor back, revert `.github/workflows/main-green.yaml` and this section.

## Deploying the playground to Vercel

The playground (`@cinder/playground`) is a `Bun.serve` dev server that compiles Svelte component bundles on the fly with `Bun.build` + `svelte/compiler` + `ts-morph` — no SvelteKit, no Vite. That on-the-fly-build toolchain runs fine at **build** time but cannot run inside a deployed serverless function (the bundled Lambda can't resolve the dev-toolchain module graph — every route 500s with `FUNCTION_INVOCATION_FAILED` / a Bun `ResolveMessage`). So we don't deploy the server. We **pre-render every route to static files at build time** and Vercel serves those — a pure static site, zero cold-start, no toolchain in production.

The moving parts:

- `packages/playground/src/playground-server.ts`: the `Bun.serve` dev server. Its `handleRequest` (a `(Request) => Promise<Response>`) is the whole router, reused verbatim by the pre-render. It is **deliberately not** named `server`/`index`/`app`/`main`: those are Vercel's Bun backend-entrypoint magic names, and matching one would make Vercel auto-detect a root function and try to _run_ it — re-introducing the runtime failure the static export avoids. The `import.meta.main` block is the local dev/CLI path (it binds a port + file watcher) and never runs in the build.
- `packages/playground/scripts/static-export.ts` (the `vercel-build` npm script): drives `handleRequest` at build time and writes every route's response into `public/` — `/c/<name>` and `/page/<name>` HTML, `/shell-bundle/*` + `/page-bundle/*` JS (following each bundle's hashed-chunk imports), `/styles/*` + `/components/*` CSS, `/api/manifest/<name>` JSON, `/example-src/*` source, and a `/ping` (so the deploy smoke-test has a static `pong`). HTML pages are written as `index.html` directories (clean URLs); data routes are written as literal extensionless files.
- `packages/playground/vercel.json`: `framework: null`, the `vercel-build` build command, `outputDirectory: "public"`, `cleanUrls: true`, and a single rewrite of `/` to the pre-rendered redirect `index.html`. No `functions`, no `bunVersion` runtime — nothing executes at request time.
- `.github/workflows/deploy-playground.yaml`: deploys on push to `main` (production) and on pull requests (preview). It uses the Vercel CLI (`vercel pull` → `vercel build` → `vercel deploy --prebuilt`) and finishes with a `/ping` smoke-test.

### The tradeoff (read this)

The full site is rendered at build time (≈90s for ~90 components / ~1500 files), so deploys are slower than a function deploy but every request is served instantly from static assets with no runtime compilation. Because the export is a point-in-time snapshot, the deployed playground reflects the components as of the build — re-deploy to pick up component changes (the GitHub workflow does this automatically on push to `main`). For an internal component playground this is the right tradeoff; the live, watch-mode dev server (`bun run dev`) remains the authoring experience.

### One-time setup (a human must do this — it is not automated)

Nothing below is performed by this repository or its workflows. A maintainer with Vercel access must do it once:

1. **Create the Vercel project.** In the Vercel dashboard, import this Git repository as a new project (or run `bunx vercel link` locally from the repo root and follow the prompts).
2. **Set the Root Directory to `packages/playground`.** This is a Vercel **project setting** (Settings → General → Root Directory), not a `vercel.json` key — `rootDirectory` is intentionally absent from `vercel.json` because Vercel does not read it there. With the root set, Vercel reads `packages/playground/vercel.json` and runs the configured `installCommand` (which installs the whole Bun workspace from the repo root, because `cinder` is a `workspace:*` dependency). **Also enable "Include files outside of the root directory in the Build Step"** (the toggle directly under Root Directory) — the static-export build reads component sources from `../components` at build time, and that toggle must be on for those files to be available during the build.
3. **Capture the three deploy secrets** and add them to the repository's GitHub Actions secrets (Settings → Secrets and variables → Actions):

   | Secret              | Where it comes from                                                                                |
   | ------------------- | -------------------------------------------------------------------------------------------------- |
   | `VERCEL_TOKEN`      | Vercel → Account Settings → Tokens → Create Token (scope it to the team that owns the project).    |
   | `VERCEL_ORG_ID`     | `.vercel/project.json` after `bunx vercel link`, or Team Settings → General → Team ID.             |
   | `VERCEL_PROJECT_ID` | `.vercel/project.json` after `bunx vercel link`, or the project's Settings → General → Project ID. |

   The workflow reads `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` from `env` and passes `VERCEL_TOKEN` to each CLI invocation. Fork pull requests can't read these secrets, so the deploy job skips itself on fork PRs rather than failing.

### Verifying a live deploy (the smoke-test)

Once the project and secrets exist, a push to `main` triggers `deploy-playground`. To check the result by hand (or after a `bunx vercel deploy` from your machine), hit the two health endpoints on the deployment URL:

```bash
# 1. Liveness — must return the literal text "pong".
curl https://<your-deployment>.vercel.app/ping
# → pong

# 2. A real component page renders (returns 200 with the shell HTML).
curl -i https://<your-deployment>.vercel.app/c/button | head -n 1
# → HTTP/2 200
```

The workflow's `Smoke-test the deployment` step runs the `/ping` check automatically and writes the result to the job summary. If your Vercel plan has Deployment Protection enabled, the raw deployment URL may return `401` until you visit it authenticated — that is a gating response, not a deploy failure; verify through the dashboard's preview link instead.

### Running the build locally

The build step is runtime-safe to run on any machine with Bun:

```bash
cd packages/playground
bun run vercel-build   # pre-renders every route into public/
```

It does not contact Vercel or deploy anything — it just produces the static `public/` directory locally so you can inspect or serve it.

## Commits and pull requests

- Conventional commit prefixes (`feat`, `fix`, `refactor`, `docs`, `chore`).
- Run `bun run lint && bun run typecheck && bun test` before opening a PR.
- PRs go through the multi-agent committee review before merging.

## Changesets

If your pull request changes anything that ships in the `cinder` npm package (the workspace at `packages/components/`), add a changeset:

```bash
bun x changeset
```

Pick the appropriate semver bump (`patch`, `minor`, `major`), write a short summary, and commit the generated file under `.changeset/`. The release workflow (`.github/workflows/release.yaml`) consumes pending changesets to open a "Version Packages" pull request; merging that PR publishes to npm with provenance.

The npm artifact has one source of truth: `packages/components/scripts/pack-for-publish.ts`. Consumer validation, release dry-runs, the Changesets publish path, and the manual break-glass workflow all publish or inspect the staged tarball from that script. Do not publish from raw `packages/components/package.json`; that source manifest contains workspace-only development dependencies and scripts that are intentionally stripped from the released artifact.

Before a release, `bun run --filter=cinder validate:consumer` installs the staged tarball into consumer fixtures, runs the Svelte peer compatibility matrix (`5.55.0`, workspace `~5.55.0`, latest `svelte@^5`), and checks tarball hygiene. `bun run --filter=cinder package:weight:check` reports packed size, unpacked size, file count, largest entry directories, and largest files, then fails on budget drift.

Only `cinder` (the workspace at `packages/components/`) publishes to npm; the other `@cinder/*` workspaces are private. Changes confined to `@cinder/playground` (the only private workspace with no dependents and listed under `ignore` in `.changeset/config.json`) do not need a changeset. The remaining private workspaces (`@cinder/commentary`, `@cinder/diff`, `@cinder/editor`, `@cinder/markdown`, `@cinder/testing`) are `workspace:*` dependencies of `cinder`, so changes to them generally do warrant a `cinder` changeset — they ship inside the published package.
