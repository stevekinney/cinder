# @cinder/testing

Browser tests for the Cinder component playground using Playwright.

## Setup

Install Chromium locally:

```bash
bun run --filter='@cinder/testing' install-browsers
```

Use the CI variant when system dependencies need to be installed:

```bash
bun run --filter='@cinder/testing' install-browsers:ci
```

## Running

Run the Playwright tests:

```bash
bun run --filter='@cinder/testing' test
```

The test script manages the playground server automatically. If a playground server is already running on port `4173`, set `PLAYWRIGHT_REUSE_SERVER=1` to reuse it:

```bash
PLAYWRIGHT_REUSE_SERVER=1 bun run --filter='@cinder/testing' test
```

Open the HTML report:

```bash
bun run --filter='@cinder/testing' report
```

## Artifacts

- `playwright-report/`
- `test-results/playwright/`
- `test-results/axe/`
- `test-results/axe-summary.json`
- `.playwright/manifest.json`

## v1 Non-Goals

- Interaction state testing
- Visual regression or screenshot diffing
- Axe violation gating; violations are reported but do not fail the suite
