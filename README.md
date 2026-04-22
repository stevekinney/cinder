# Project Name

## Prerequisites

- [Bun](https://bun.sh) installed on your machine.

## Installation

Create a new project based on this template:

```bash
# Basic installation
bun create github.com/stevekinney/bun-template $PROJECT_DIRECTORY

# Skip installing dependencies (useful for CI or offline work)
bun create github.com/stevekinney/bun-template $PROJECT_DIRECTORY --no-install
```

The `--no-install` flag is helpful when:

- Working in offline environments
- Using CI pipelines with cached dependencies
- You plan to modify dependencies before installation

## Core Tools

- Bun: runtime, bundler, test runner, and package manager
- TypeScript: strict type checking
- ESLint + Prettier: linting and formatting (flat config)
- Husky + lint-staged: fast pre-commit checks

## Development

Start the development server:

```bash
bun run dev
```

### Git Hooks (Husky)

Husky is set up via the `prepare` script on install. Hooks are implemented as Bun TypeScript files in `scripts/husky/` and invoked by wrappers in `.husky/`.

- `pre-commit`: runs lint-staged; ensures `bun.lock` is staged when it has changes alongside `package.json`.
- `post-checkout`: on branch checkouts, installs deps when `package.json` + `bun.lock` changed; surfaces config changes.
- `post-merge`: installs deps and cleans caches when config changed; prints merge stats and conflict checks.

Use `--no-verify` to bypass hooks (not recommended).

### Running Tests

This template comes with Bun's built-in test runner. To run tests:

```bash
bun test
```

For watching mode:

```bash
bun test --watch
```

For test coverage:

```bash
bun test --coverage
```

### Continuous Integration

No CI workflows are included by default. Add your own under `.github/workflows/` as needed.

### Understanding `bun run` vs `bunx`

`bun run` and `bunx` are two different commands that often confuse beginners:

- **bun run**: Executes scripts defined in your project's package.json (like `bun run dev` runs the "dev" script). Also runs local TypeScript/JavaScript files directly (like `bun run src/index.ts`).

- **bunx**: Executes binaries from npm packages without installing them globally (similar to `npx`). Use it for one-off commands or tools you don't need permanently installed (like `bunx prettier --write .` or `bunx shadcn@canary add button`).

## Project Structure

- `src/` - Source code for your application
- `.husky/` - Git hook wrappers (shell) calling Bun scripts in `scripts/husky/`
- `scripts/husky/` - Hook implementations (TypeScript + Bun)

## Customization

### TypeScript Configuration

The template includes TypeScript configuration with path aliases:

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

## Template Setup (bun-create)

When using `bun create` with this template, a postinstall sequence runs once to bootstrap the project:

- Sets `package.json:name` from the folder name
- Copies `.env.example` to `.env` (or appends missing keys)
- Writes `OPEN_AI_API_KEY`, `ANTHROPIC_AI_API_KEY`, and `GEMINI_AI_API_KEY` from your shell into `.env` if present
- Runs `bun run prepare` to install Husky
- Cleans up setup scripts and removes the `bun-create` entry from `package.json`

These steps self-delete after running; you can adjust them by editing files in `scripts/setup/` before the first install.
