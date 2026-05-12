# @cinder/testing

Browser tests for the Cinder component playground using Playwright + axe-core. For every component in `/api/manifest`, the suite runs an accessibility scan and captures a viewport screenshot in two themes (`light`, `dark`) and three viewports (`mobile`, `tablet`, `desktop`).

## Setup

One-time Chromium install:

```bash
# From the repo root
bun run test:browser:install
```

CI uses `install-browsers:ci` instead, which also installs system dependencies.

## Running

From the repo root:

```bash
bun run test:browser         # Run the full suite
bun run test:browser:headed  # Same, with a visible browser
bun run test:browser:ui      # Open Playwright's UI mode
```

Or from inside `packages/testing`:

```bash
bun run test:playwright
bun run test:playwright:headed
bun run test:playwright:ui
```

`start-server.ts` manages the playground server automatically. By default it will reuse an already-running playground on the target URL (`PLAYGROUND_URL`, default `http://localhost:4173`). Set `PLAYWRIGHT_REUSE_SERVER=0` to force a hard failure if the port is already taken.

### Reproducing a single failing test

Playwright's `--grep` filter accepts a regex matched against the full test path (`<Component> > <theme>-<viewport>`). Forward extra args through the package script:

```bash
# From the repo root, headed, just the Accordion dark-desktop case:
PLAYWRIGHT_REUSE_SERVER=1 bun run --filter='@cinder/testing' test:playwright:headed -- --grep "Accordion > dark-desktop"

# From inside packages/testing:
bun run test:playwright -- --grep "Modal"
```

Open the HTML report after a run:

```bash
bun run --filter='@cinder/testing' report
# or, from inside packages/testing:
bun run report
```

## Artifacts

All gitignored. Paths are relative to `packages/testing/`:

- `playwright-report/` — HTML report (also uploaded on CI failure).
- `test-results/playwright/` — per-test trace, video, attachment output.
- `test-results/axe/<slug>/<theme>-<viewport>.json` — full axe violation payloads.
- `test-results/axe-summary.json` — rolled-up totals, top rules, top components.
- `screenshots/<slug>/<theme>-<viewport>.png` — viewport screenshots.
- `.playwright/manifest.json` — cached `/api/manifest` snapshot + digest.

## v1 non-goals

- No interaction-state testing — components are scanned in their default render. A modal that ships closed is scanned closed.
- No visual regression / screenshot diffing — captures are for human review only.
- No axe gating — violations are recorded but do not fail the suite. The baseline informs a follow-up plan that converts severity buckets into hard assertions.

## Known CI flakes

On the GitHub Actions Linux runner, four components are skipped via the `SLOW_ON_CI` set in `tests/components.spec.ts`: `code-block`, `chat`, `markdown-editor`, `review-editor`. Two failure modes are at play:

1. `code-block` hits a `Bun.build` "Multiple files share the same output path" error in the playground's lazy page-bundle build path. Reproducible on Linux only.
2. The three editor components (Chat, MarkdownEditor, ReviewEditor) take longer than the fixture's `#app > *` wait window to mount on the runner.

Both manifest as `waitForSelector` timeouts in CI but pass cleanly on local hardware. The skip is gated on `process.env.CI` so local runs still exercise the full matrix. A follow-up will fix the playground build path and remove the skip.
