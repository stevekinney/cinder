# @lostgradient/testing

A private workspace of small, target-owned checks the rest of the mirror depends on.

COR-1196 retired this package's Playwright/axe-core visual-regression harness (`tests/`, `snapshots/`, `playwright.config.ts`, `Dockerfile`, and every script that harness alone needed) from this repository. What is left:

- `scripts/source-fingerprint.ts` — the content-hash helper `packages/playground/src/playground-server.ts` imports to detect a stale build.
- `scripts/local-bun-version-guard.ts` — the warn-only local/CI Bun version check `packages/components`'s `check:local-bun-version-guard` script runs.

Run this package's own checks with:

```bash
bun run --filter='@lostgradient/testing' typecheck
bun run --filter='@lostgradient/testing' test
```

The mirror sync keeps this private workspace's package name aligned with Corvidae.
