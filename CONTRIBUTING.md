# Contributing to cinder

## Getting set up

```bash
bun install
bun run dev          # start the playground
bun run typecheck
bun run --filter=@lostgradient/cinder test  # focused component tests
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

The component package checks its source with `bun run --filter=@lostgradient/cinder lint`. For CSS and Svelte style blocks in this mirror, run `bunx stylelint "packages/**/src/**/*.{css,svelte}"`. Corvidae owns the complete source lint gate before synchronization.

When `left`/`right` carries semantic placement (e.g. `data-placement="left"` selectors on a tooltip), use the rule's `/* stylelint-disable-next-line csstools/use-logical */` escape hatch and add a comment explaining why the physical axis is intentional.

[logical-properties]: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_logical_properties_and_values

## Validation ownership

Corvidae owns complete source lint, type, unit, coverage, and browser validation. Its exact validated revision is recorded in each mirror commit. This public repository verifies the generated package artifacts through `mirror-verify` on pull requests and through the release workflow before publishing. For target-owned changes, run focused package checks and verify the generated tarballs rather than invoking removed root scripts.

## Turborepo remote cache

The retained root `build` and `typecheck` commands use Turborepo. Local cache entries live in this checkout's `.turbo/cache/`; each worktree needs its own frozen Bun installation. If a target-owned task imports files outside its package, declare those inputs in `turbo.json` so a cache hit cannot hide a change. A package-task override replaces the base task definition, so retain required dependency edges when adding one.

## Tests

- Unit tests use `bun:test` and live alongside the source as `*.test.ts`.
- The private Corvidae source workspace owns component browser fixtures; this public mirror retains package tests and consumer verification.
- Every fix should land with a regression test.

### Visual regression

The Playwright screenshot harness and baseline-update workflow moved to the private Corvidae source workspace. This mirror no longer contains `packages/testing/tests`, snapshot baselines, or browser-update scripts. Run the package's focused tests here and review the corresponding Corvidae browser fixture results for visual changes before synchronizing the mirror.

### Coverage

Corvidae's complete source validation enforces component coverage before mirroring. The public mirror's `mirror-verify` workflow checks the exact built and packed artifacts instead of replaying source coverage on copied files.

## Mirror verification

The generated `.github/workflows/mirror-verify.yaml` is the public pull request gate. It installs the target with the release workflow's Bun settings, builds and packs each published package, checks declarations and package entry points, and runs isolated consumer checks. The release workflow calls the same verifier before publication.

## Deploying the playground to Vercel

The playground (`@cinder/playground`) is a `Bun.serve` dev server that compiles Svelte component bundles on the fly with `Bun.build` + `svelte/compiler` + `ts-morph` — no SvelteKit, no Vite. That on-the-fly-build toolchain runs fine at **build** time but cannot run inside a deployed serverless function (the bundled Lambda can't resolve the dev-toolchain module graph — every route 500s with `FUNCTION_INVOCATION_FAILED` / a Bun `ResolveMessage`). So we don't deploy the server. We **pre-render every route to static files at build time** and Vercel serves those — a pure static site, zero cold-start, no toolchain in production.

The moving parts:

- `packages/playground/src/playground-server.ts`: the `Bun.serve` dev server. Its `handleRequest` (a `(Request) => Promise<Response>`) is the whole router, reused verbatim by the pre-render. It is **deliberately not** named `server`/`index`/`app`/`main`: those are Vercel's Bun backend-entrypoint magic names, and matching one would make Vercel auto-detect a root function and try to _run_ it — re-introducing the runtime failure the static export avoids. The `import.meta.main` block is the local dev/CLI path (it binds a port + file watcher) and never runs in the build.
- `packages/playground/scripts/static-export.ts` (the `vercel-build` npm script): drives `handleRequest` at build time and writes every route's response into `public/` — `/c/<name>` and `/page/<name>` HTML, `/shell-bundle/*` + `/page-bundle/*` JS (following each bundle's hashed-chunk imports), `/styles/*` + `/components/*` + `/package-components/*` CSS, `/api/manifest/<name>` JSON, `/example-src/*` source, and a `/ping` (so the deploy smoke-test has a static `pong`). HTML pages are written as `index.html` directories (clean URLs); data routes are written as literal extensionless files.
- `packages/playground/vercel.json`: `framework: null`, the `vercel-build` build command, `outputDirectory: "public"`, `cleanUrls: true`, and a single rewrite of `/` to the pre-rendered redirect `index.html`. No `functions`, no `bunVersion` runtime — nothing executes at request time.
- `.github/workflows/deploy-playground.yaml`: deploys on push to `main` (production) and on pull requests (preview). It uses the Vercel CLI (`vercel pull` → `vercel build` → `vercel deploy --prebuilt`) and finishes with a `/ping` smoke-test.

### The tradeoff (read this)

The full site is rendered at build time, so deploys are slower than a function deploy but every request is served instantly from static assets with no runtime compilation. Because the export is a point-in-time snapshot, the deployed playground reflects the components as of the build — re-deploy to pick up component changes (the GitHub workflow does this automatically on push to `main`). For an internal component playground this is the right tradeoff; the live, watch-mode dev server (`bun run dev`) remains the authoring experience.

### One-time setup (a human must do this — it is not automated)

Nothing below is performed by this repository or its workflows. A maintainer with Vercel access must do it once:

1. **Create the Vercel project.** In the Vercel dashboard, import this Git repository as a new project (or run `bunx vercel link` locally from the repo root and follow the prompts).
2. **Set the Root Directory to `packages/playground`.** This is a Vercel **project setting** (Settings → General → Root Directory), not a `vercel.json` key — `rootDirectory` is intentionally absent from `vercel.json` because Vercel does not read it there. With the root set, Vercel reads `packages/playground/vercel.json` and runs the configured `installCommand` (which installs the whole Bun workspace from the repo root because `@lostgradient/cinder` and `@lostgradient/chat` are workspace dependencies). **Also enable "Include files outside of the root directory in the Build Step"** (the toggle directly under Root Directory) — the static-export build reads component sources from `../components` and `../chat` at build time, and that toggle must be on for those files to be available during the build.
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
- Run focused checks for changed target-owned files, `bun run typecheck` when types are affected, and confirm the generated `mirror-verify` pull request check passes.
- PRs go through the multi-agent committee review before merging.
- If this PR's completion depends on a manual step outside CI (a UI toggle, a credential-gated bootstrap, a flag flip plus deploy), file a blocking issue in the project's tracker (Linear internally; a GitHub issue for external contributors) in the owning team at merge time with binary evidence criteria — an authenticated endpoint response, a registry query, a deployment status. A merged PR and a checked box in the PR body are not evidence.

## Changesets

Five workspaces publish to npm under the `@lostgradient` scope: `markdown` (`packages/markdown/`), `cinder` (`packages/components/`), `cinder-mcp` (`packages/mcp/`), `editor` (`packages/editor/`), and `chat` (`packages/chat/`). If your pull request changes anything that ships in one of these, add a changeset:

```bash
bun x changeset
```

Pick the appropriate semver bump (`patch`, `minor`, `major`), write a short summary, and commit the generated file under `.changeset/`. The release workflow (`.github/workflows/release.yaml`) consumes pending changesets to open a "Version Packages" pull request; merging that PR publishes to npm through npm Trusted Publishing.

Every public package is pre-1.0 — every changeset for one of them must use `minor` or `patch`, never `major` (`bun run --filter=@lostgradient/cinder check:changeset-prerelease-bumps` enforces this during release).

`@lostgradient/cinder-mcp` depends on `@lostgradient/cinder`'s `./knowledge` export (published `dist/cli/knowledge.js`) rather than owning any component metadata itself. A change to Cinder's knowledge service (`packages/components/src/cli/knowledge.ts` and friends) that could affect `cinder-mcp`'s behavior should carry a changeset for both packages, not just Cinder.

Each npm artifact has one staged-pack source of truth: `packages/components/scripts/pack-for-publish.ts` for Cinder, `packages/markdown/scripts/pack-for-publish.ts` for Markdown, `packages/mcp/scripts/pack-for-publish.ts` for cinder-mcp, `packages/editor/scripts/pack-for-publish.ts` for Editor, and `packages/chat/scripts/pack-for-publish.ts` for Chat. Consumer validation, release dry-runs, and both publish paths use those exact tarballs. Do not publish directly from any source manifest; workspace-only development dependencies and scripts are intentionally stripped from released artifacts. `cinder-mcp`'s packer additionally rewrites its `@lostgradient/cinder: workspace:*` dependency to a concrete `^<Cinder version>` range in the staged manifest.

Before a release, Corvidae validates the source revision and the public mirror checks the target artifact in its generated workflow. The release workflow validates every artifact before publishing any of them: each package's `validate:consumer` command installs staged tarballs into consumer fixtures, and each `package:weight:check -- --existing-tarball` command applies a package-specific budget. `cinder-mcp`'s `validate:consumer` installs BOTH its own and Cinder's staged tarballs via npm (never the workspace source, and never a registry-resolved Cinder — an `overrides` entry forces resolution to the staged tarball), then runs a full MCP handshake through `npx --no-install cinder-mcp` under plain Node with Bun made unresolvable in the child environment. Publish order follows the dependency DAG — markdown → cinder → cinder-mcp → editor → chat — and every publisher skips idempotently when the exact registry version already exists.

Changes confined to `@cinder/playground` or `@lostgradient/testing` do not need a changeset — those workspaces are private and never publish. Changes to other private workspaces bundled by Cinder generally require a Cinder changeset because their output ships in its artifact.

### Publishing to npm

The primary release workflow (`.github/workflows/release.yaml`) uses **npm Trusted Publishing (OIDC)**. No long-lived npm token is stored in GitHub Actions secrets for normal releases. The `id-token: write` job permission grants the workflow an OIDC token, and npm >= 11.5.1 exchanges that token for a publish grant automatically.

#### One-time registry configuration (a maintainer must do this once in the npm web UI)

npm Trusted Publishing must be configured independently on each of the five package pages ([`@lostgradient/cinder`](https://www.npmjs.com/package/@lostgradient%2Fcinder), [`@lostgradient/cinder-mcp`](https://www.npmjs.com/package/@lostgradient%2Fcinder-mcp), [`@lostgradient/chat`](https://www.npmjs.com/package/@lostgradient%2Fchat), [`@lostgradient/markdown`](https://www.npmjs.com/package/@lostgradient%2Fmarkdown), and [`@lostgradient/editor`](https://www.npmjs.com/package/@lostgradient%2Feditor)):

1. Navigate to each package → **Settings** → **Publishing** → **Add a publisher**.
2. Select **GitHub Actions** as the provider.
3. Set these values exactly:

   | Field             | Value           |
   | ----------------- | --------------- |
   | Repository owner  | `stevekinney`   |
   | Repository name   | `cinder`        |
   | Workflow filename | `release.yaml`  |
   | Environment       | _(leave blank)_ |

4. Save. The registry will now accept OIDC tokens from that workflow without a static secret.

Until this is configured for a given package, its OIDC publishes will be rejected even though the workflow is otherwise correct. **A package must exist on npm before its Trusted Publisher can be configured** — npm Trusted Publishing cannot mint a brand-new package name — so every package's very first release requires a one-time manual bootstrap: publish it via `release-manual.yaml`'s token path (a narrowly scoped `NPM_TOKEN`), verify with `npm view <package>@<version>`, then configure its Trusted Publisher so `release.yaml` can publish future versions through OIDC. This has already happened for Markdown, Cinder, Editor, and Chat; `@lostgradient/cinder-mcp` still needs it for its first `0.1.0` release (see `release-manual.yaml`'s `mcp` package selection and `mcp-v<version>` tag contract). A downstream package's manual bootstrap also verifies its required upstream version already exists on npm first (e.g. cinder-mcp's bootstrap checks for a published Cinder version satisfying its pinned `^<version>` range) — publish upstream first.

#### The workflow validation guard

`bun run --filter=@lostgradient/cinder validate:workflow` includes a check that asserts `release.yaml` does not contain `NODE_AUTH_TOKEN` or `NPM_TOKEN` anywhere outside comments — not in the publish step's `env:`, and not in a job-level or workflow-level `env:` block that the publish step would silently inherit. The primary release workflow also runs `bun run --filter=@lostgradient/cinder validate:release-workflow` directly on every push so token regressions and ignored-package changesets fail before Changesets opens or updates a release pull request. The guard lives at `packages/components/scripts/validate-release-workflow.ts` and asserts the full five-package publish order.

#### Break-glass fallback

If the Changesets/OIDC path fails and a release is urgent, `.github/workflows/release-manual.yaml` is the documented fallback. It:

- Requires a package selection (`cinder`, `mcp`, `chat`, `markdown`, or `editor`) and a package-qualified version tag such as `cinder-v0.16.0` or `mcp-v0.1.0`.
- Uses `NPM_TOKEN` (a Granular Access Token scoped only to the public packages this workflow can select, stored in repository secrets).
- Uses the same staged tarball validation as the primary workflow and disables provenance until the publish runtime can sign cleanly.

**Use this workflow only when the primary path is broken.** Routine releases must go through the Changesets PR flow into `main` and the primary `release.yaml`.

Token hygiene for the break-glass secret:

- Rotate `NPM_TOKEN` at least every 90 days.
- Use a Granular Access Token scoped only to the five public `@lostgradient/*` packages — never a full-access automation token.
- After a break-glass publish, investigate and restore the primary OIDC path before the next release.
