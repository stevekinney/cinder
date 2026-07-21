# AGENTS.md

> **Building an app that uses cinder?** Read [`packages/components/AGENTS.md`](./packages/components/AGENTS.md) § Using cinder in your app.
>
> **Editing cinder itself?** Read [`packages/components/AGENTS.md`](./packages/components/AGENTS.md) § Contributing to cinder.

This file covers repo-wide Bun workspace conventions.

## Essential Commands

### Development

```bash
bun install              # Install workspace dependencies
bun run dev              # Start the playground dev server
bun run playground       # Alias for the playground dev server
bun run build            # Build @lostgradient/cinder, then @lostgradient/chat
```

### Testing

```bash
bun run test             # Run all workspace test scripts
bun run typecheck        # TypeScript and Svelte type checks
bun run lint             # Oxlint plus Stylelint
bun run test:browser     # Playwright browser suite
bun run validate         # Full workspace/package validation gate
```

For component-package tests, prefer the package script so the browser and locale conditions are applied:

```bash
bun run --filter=@lostgradient/cinder test
bun run --filter=@lostgradient/cinder test:coverage
```

### Code Quality

```bash
bun run format           # Format all supported source and documentation files
bun run format:check     # Check formatting without changes
bun run lint:fix         # Auto-fix supported lint issues
```

### Package Artifacts

```bash
bun run --filter=@lostgradient/cinder components:generate
bun run --filter=@lostgradient/cinder components:check
bun run --filter=@lostgradient/cinder exports:check
bun run --filter=@lostgradient/cinder validate:consumer
bun run --filter=@lostgradient/cinder package:weight:check
bun run --filter=@lostgradient/chat components:generate
bun run --filter=@lostgradient/chat components:check
bun run --filter=@lostgradient/chat validate:consumer
bun run --filter=@lostgradient/chat package:weight:check
```

Run `components:generate` after changing component source metadata, examples, constraints, variables, generated README sections, or export-affecting component files.

## Workspace Layout

| Workspace             | Purpose                                                                               |
| --------------------- | ------------------------------------------------------------------------------------- |
| `packages/components` | Published `@lostgradient/cinder` package.                                             |
| `packages/chat`       | Published `@lostgradient/chat` domain package.                                        |
| `packages/playground` | Private component playground and static export.                                       |
| `packages/testing`    | Private Playwright, axe, and visual-regression harness.                               |
| `packages/diff`       | Private diff utilities used by domain-suite components.                               |
| `packages/markdown`   | Private Markdown pipeline, rendering, and template-placeholder utilities.             |
| `packages/commentary` | Private review/comment anchoring and editor (ProseMirror/Milkdown) runtime utilities. |

## Architecture Notes

- **Bun workspace:** Use `bun` commands and the root `bun.lock`; do not introduce npm or Yarn lockfiles.
- **Published packages:** `@lostgradient/cinder` lives in `packages/components`; `@lostgradient/chat` lives in `packages/chat` and declares Cinder plus its runtime libraries as peers.
- **Private packages:** `@cinder/*` packages are private implementation workspaces. Some are packed into the published artifact through `packages/components/scripts/pack-for-publish.ts`.
- **Svelte 5:** The public peer range is `svelte >=5.56.0 <6`.
- **Styles:** The base stylesheet is `@lostgradient/cinder/styles`; component CSS is opt-in through `@lostgradient/cinder/<component>/styles`, or all-in through `@lostgradient/cinder/styles/all`.
- **Generated metadata:** `packages/components/components.json` is the source for machine-readable component discovery. Component READMEs, schemas, variables, examples, constraints, and package exports are generated from component source and sidecars.
- **Worktrees need a real `node_modules`:** never symlink a worktree's root `node_modules` to another checkout's. Doing so aliases one dependency tree under two path prefixes, which collides Bun's path-keyed module cache — local SSR/hydration test runs then fail deterministically with `Unseekable reading file: .../node_modules/esm-env/index.js` (or Bun parsing a package's `package.json` as JavaScript), pointing at a healthy file and reading like flakiness. Run a real `bun install` in each worktree. `pre-push` **detects** a symlinked tree and names the fix, but does not repair it — per the fail-open push layer in [`docs/validation-topology.md`](./docs/validation-topology.md), nothing in that hook can fail a push, and it deliberately mutates nothing: the value is naming an opaque failure, not saving one `bun install`.

## Documentation

- Root consumer/developer overview: [`README.md`](./README.md)
- Long-form docs index: [`docs/README.md`](./docs/README.md)
- Published package README: [`packages/components/README.md`](./packages/components/README.md)
- Chat package README: [`packages/chat/README.md`](./packages/chat/README.md)
- Package contribution guidance: [`packages/components/AGENTS.md`](./packages/components/AGENTS.md)

When documentation mentions commands, prefer root workspace commands with `bun run --filter=<package>` for package-specific gates. Avoid bare `bun test` in docs unless the local package script intentionally wraps it.
