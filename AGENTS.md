# AGENTS.md

> **Building an app that uses cinder?** Read [`packages/components/AGENTS.md`](./packages/components/AGENTS.md) § Using cinder in your app.
>
> **Editing cinder itself?** Read [`packages/components/AGENTS.md`](./packages/components/AGENTS.md) § Contributing to cinder.

The rest of this file covers the repo-wide Bun/runtime/testing conventions.

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Essential Commands

### Development

```bash
bun run dev               # Start development with watch mode
bun run build             # Build for production (outputs to dist/)
# Run production build
bun ./dist/index.js       # After build, run with Bun
```

### Testing

```bash
bun test                  # Run all tests
bun test src/utils        # Run tests in specific directory
bun test logger          # Run tests matching pattern
bun test --watch         # Watch mode
bun test --coverage      # Generate coverage report
```

### Code Quality

```bash
bun run lint             # Check linting errors
bun run lint:fix         # Auto-fix linting errors
bun run typecheck        # TypeScript type checking
bun run format           # Format all files with Prettier
bun run format:check     # Check formatting without changes
```

### Utilities

```bash
bun run clean            # Clean build artifacts (dist/, coverage/, caches)
```

## Architecture Overview

### Core Design Principles

1. **Environment-First Configuration**: All configuration starts with environment variables validated through Zod schemas in `src/environment.ts`. The `environment` object is the single source of truth.

2. **Lean Surface Area**: This template intentionally avoids framework-specific scaffolding (custom error classes, logger wrappers, etc.). Add only what you need for your project.

### Key Notes

- **ESM + TypeScript**: Source files are TypeScript modules; build output targets Bun.
- **Import paths**: Use standard TS/ESM imports; no special runtime helpers are required.

### Git Hooks Architecture

Hooks live as Bun TypeScript files under `scripts/husky/` and are invoked by tiny sh wrappers in `.husky/`:

- `pre-commit`: runs lint-staged and basic dependency checks
- `post-checkout`: installs deps when `package.json`+`bun.lock` change; surfaces config changes
- `post-merge`: installs/cleans when dependencies or config changed; shows merge stats

They use `chalk` for color, `change-case` for headings, and Bun’s `$` and `Bun.write` for shell/IO.

### Types

There is no shared `src/types.ts` in this template. Add shared or domain-specific types near their modules as needed.

## Development Patterns

### Adding New Features

1. **Environment variables**: Add to `.env.example` first, then update the schema in `src/environment.ts`.
2. **Types**: Shared/reusable types go in `src/types.ts`; domain-specific types live near their modules.

### Testing Approach

- Tests use Bun's built-in test runner with `describe`, `it`, `expect`.
- Test files are typically colocated with sources using the `.test.ts` suffix.
- Oxlint rules are relaxed for test files (`*.test.ts`, `*.spec.ts`, `test/**`, `__tests__/**`). You can use `any`, non-null assertions, unused variables, and other patterns that would normally be flagged.
- A separate `tsconfig.test.json` is available with relaxed TypeScript settings for tests.

### Import Organization

Prettier plus import sorting keeps imports consistent. A common order is:

1. Bun built-ins (e.g., `import { file, write } from 'bun'`)
2. Node built-ins (e.g., `import { readFile } from 'node:fs'`)
3. External packages (e.g., `import { z } from 'zod'`)
4. Internal absolute imports (e.g., `@/configuration/environment`)
5. Relative imports (e.g., `./local-module`)

## Bun-Specific Considerations

- Always use `bun` commands, not `npm` or `yarn`.
- The lockfile in this repo is `bun.lock`.
- Bun provides native TypeScript execution without precompilation.
- Use `bunx` for one-off package execution (like `npx`).

### Prefer Bun Built-ins Over Node

When possible, use Bun's native APIs instead of Node.js equivalents. Bun's APIs are optimized for performance and often have a simpler interface.

| Task          | Use (Bun)                                | Avoid (Node)                     |
| ------------- | ---------------------------------------- | -------------------------------- |
| Read file     | `Bun.file(path).text()`                  | `fs.readFileSync(path, 'utf-8')` |
| Write file    | `Bun.write(path, data)`                  | `fs.writeFileSync(path, data)`   |
| HTTP server   | `Bun.serve()`                            | `http.createServer()` or Express |
| Hashing       | `Bun.hash()` or `new Bun.CryptoHasher()` | `crypto.createHash()`            |
| Spawn process | `Bun.spawn()` or `Bun.$`                 | `child_process.spawn()`          |
| Sleep         | `Bun.sleep(ms)`                          | `setTimeout` with promisify      |
| Environment   | `Bun.env.VAR`                            | `process.env.VAR`                |
| Glob          | `Bun.Glob`                               | `glob` package                   |

When a Bun equivalent doesn't exist or Node's API is more appropriate for the use case, use the `node:` prefix for clarity (e.g., `import { join } from 'node:path'`).

### Configuration Notes

- **bunfig.toml**: Build targets Bun with sourcemaps and minification.
- **TypeScript**: Uses Bun types; Node type libs are not included by default.
- **Oxlint**: Rust-based linter with built-in TypeScript, promise, unicorn, and import plugins. Type-aware rules enabled via `--type-aware --tsconfig ./tsconfig.json`. Import sorting and unused import removal handled by Prettier via `prettier-plugin-organize-imports`. Test files have relaxed rules.
- **Testing**: You can run tests in parallel via `bun test --parallel`.
