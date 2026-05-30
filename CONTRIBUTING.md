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

The playground (`@cinder/playground`) is a `Bun.serve` server that builds Svelte component bundles on the fly with `Bun.build` — there is no SvelteKit, no Vite, and no pre-rendered static output. On Vercel it runs as a **single Bun Function** that delegates every request to the same `handleRequest` the dev server uses.

The moving parts:

- `packages/playground/api/index.ts`: the Vercel Function entry. It default-exports `{ fetch }` (the Web Standard handler shape Vercel accepts directly) and forwards to `handleRequest` from `src/server.ts`. No second routing table, no Node `req`/`res` shim.
- `packages/playground/vercel.json`: `bunVersion: "1.x"`, `framework: null`, the `vercel-build` build command, and `rewrites` that funnel every playground route (`/`, `/c/:name`, `/page/:name`, `/page-bundle/:f`, `/shell-bundle/:f`, `/bundle/:n/:s`, `/api/manifest*`, `/example-src/*`, `/styles/*`, `/components/*`, `/ping`, `/events`) to `/api/index`. The `functions["api/index.ts"].includeFiles` glob bundles `packages/components/{src,scripts}/**` into the function so the on-the-fly builds can read component sources at request time.
- `packages/playground/scripts/vercel-build.ts` (the `vercel-build` npm script): smoke-imports the function entry so a broken import path fails the build instead of 500-ing the first live request, then materializes the `public/` output directory Vercel expects. `public/` is git-ignored — it holds no real static assets.
- `.github/workflows/deploy-playground.yaml`: deploys on push to `main` (production) and on pull requests (preview). It uses the Vercel CLI (`vercel pull` → `vercel build` → `vercel deploy --prebuilt`) and finishes with a `/ping` smoke-test.

### The tradeoff (read this)

Because every bundle is compiled on demand, the **first** request to a given route on a cold function instance pays a `Bun.build` cost; subsequent requests to that same warm instance (including the hashed-chunk URLs an entry references) are served from the in-process cache. There is no eager pre-build on Vercel — that lives only in the dev server's `startServer`, and running it per cold start would blow the function's startup budget for routes nobody visits. This is the right tradeoff for an internal component playground; it would **not** be appropriate for a high-traffic public site, where you'd want a real static export or a long-lived container instead.

### One-time setup (a human must do this — it is not automated)

Nothing below is performed by this repository or its workflows. A maintainer with Vercel access must do it once:

1. **Create the Vercel project.** In the Vercel dashboard, import this Git repository as a new project (or run `bunx vercel link` locally from the repo root and follow the prompts).
2. **Set the Root Directory to `packages/playground`.** This is a Vercel **project setting** (Settings → General → Root Directory), not a `vercel.json` key — `rootDirectory` is intentionally absent from `vercel.json` because Vercel does not read it there. With the root set, Vercel reads `packages/playground/vercel.json` and runs the configured `installCommand` (which installs the whole Bun workspace from the repo root, because `cinder` is a `workspace:*` dependency). **Also enable "Include files outside of the root directory in the Build Step"** (the toggle directly under Root Directory) — the function's `includeFiles` glob reaches up into `../components`, and that toggle must be on for those files to be available during the build.
3. **Capture the three deploy secrets** and add them to the repository's GitHub Actions secrets (Settings → Secrets and variables → Actions):

   | Secret              | Where it comes from                                                                                 |
   | ------------------- | --------------------------------------------------------------------------------------------------- |
   | `VERCEL_TOKEN`      | Vercel → Account Settings → Tokens → Create Token (scope it to the team that owns the project).      |
   | `VERCEL_ORG_ID`     | `.vercel/project.json` after `bunx vercel link`, or Team Settings → General → Team ID.               |
   | `VERCEL_PROJECT_ID` | `.vercel/project.json` after `bunx vercel link`, or the project's Settings → General → Project ID.   |

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
bun run vercel-build   # smoke-imports api/index.ts and writes public/
```

It does not contact Vercel or deploy anything — it only proves the function entry loads.

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

Only `cinder` (the workspace at `packages/components/`) publishes to npm; the other `@cinder/*` workspaces are private. Changes confined to `@cinder/playground` (the only private workspace with no dependents and listed under `ignore` in `.changeset/config.json`) do not need a changeset. The remaining private workspaces (`@cinder/commentary`, `@cinder/diff`, `@cinder/editor`, `@cinder/markdown`, `@cinder/testing`) are `workspace:*` dependencies of `cinder`, so changes to them generally do warrant a `cinder` changeset — they ship inside the published package.
