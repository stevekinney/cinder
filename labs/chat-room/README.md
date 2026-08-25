# chat-room lab

> [!NOTE]
> Formerly the standalone `stevekinney/chatroom` repository (now archived, where the pre-merge history lives). It moved into this monorepo as `labs/chat-room` on 2026-08-25 and now consumes the workspace packages via `workspace:*` rather than the published npm tarballs.

A testbed for two components from the [`stevekinney/cinder`](https://github.com/stevekinney/cinder) workspace, driven against real data rather than fixtures:

- `Chat` from [`@lostgradient/chat`](https://www.npmjs.com/package/@lostgradient/chat), wired to the Anthropic SDK through a server-side streaming route.
- `ReviewEditor` from [`@lostgradient/editor`](https://www.npmjs.com/package/@lostgradient/editor), a Markdown editor with anchored review threads, a diff view, and a summary view, exercised by the `review-*` routes under `/exercises`.

It's not a product. The demo route and conversation wiring change often as we try things against the real components, and the point of the `/exercises` routes is to smoke out upstream defects. See [CLAUDE.md](./CLAUDE.md) for the full picture: how work moves between here and `../cinder`, the components' style/adapter/conversation-model contracts, the ReviewEditor anchor coordinate spaces, the Anthropic SDK streaming seam, and the upstream-issue-filing convention.

## Getting started

```sh
bun install
```

You'll also need an `.env` file with `ANTHROPIC_API_KEY` set. It is used server-side only, in `src/routes/api/chat/+server.ts`, and must never reach the browser.

Then:

```sh
bun run dev
```

## How the upstream packages are consumed

**From npm, as published packages — deliberately not a `bun link`.** `@lostgradient/chat`, `@lostgradient/cinder`, `@lostgradient/editor`, and `@lostgradient/markdown` are ordinary `dependencies` in `package.json`, pinned to their published versions.

Their peers are declared here too. `@lostgradient/chat` peer-depends on `@lostgradient/cinder`, `@lostgradient/markdown`, and `svelte`; `@lostgradient/editor` adds the `@milkdown/*` and `prosemirror-*` set to that same trio. Neither `conversationalist` nor `zod` is a peer of `@lostgradient/chat` — both are chat's own regular dependencies. chatroom declares `conversationalist` directly anyway, because it imports subpaths chat does not re-export, and its range has to stay identical to chat's so both resolve one instance; `bun run check:peers` enforces that one pairing. `zod` is a different case: it is here for the armorer tool schemas, **and** to satisfy a real peer range — `armorer` and `conversationalist` each declare `zod@^4.4.3` as a peer, and neither ships a nested copy, so chatroom's own `zod` is what they resolve against.

Consuming the real published tarballs — a complete `dist` + `dist/server`, the same artifacts any downstream app gets — is the whole point. A live-source `bun link` against a local `../cinder` checkout silently _masks_ packaging and SSR/hydration edge cases; it was hiding the cinder#756 hydration mismatch, which only surfaced once this repo switched to the published packages. So there is no `bun link`, no per-package CSS build, and no `vite.config.ts` SSR-condition workaround.

To move to a newer release, run `bun run sync:cinder` (see the scripts table below) rather than bumping by hand.

## Scripts

| Script                   | What it does                                                                                                                                                                                                                                                                                                   |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun run dev`            | Starts the dev server.                                                                                                                                                                                                                                                                                         |
| `bun run build`          | Production build.                                                                                                                                                                                                                                                                                              |
| `bun run preview`        | Serves the production build locally.                                                                                                                                                                                                                                                                           |
| `bun run check`          | `svelte-kit sync` + `svelte-check` (typechecking).                                                                                                                                                                                                                                                             |
| `bun run check:watch`    | Same as `check`, in watch mode.                                                                                                                                                                                                                                                                                |
| `bun run check:upstream` | Checks GitHub `upstream: <owner>/<repo>#<issue>` markers with `gh` and Linear `upstream: <linear-issue-key>` markers with `LINEAR_API_KEY`; closed issues flag their workarounds for removal.                                                                                                                  |
| `bun run check:peers`    | Verifies that a dependency this repo re-declares still matches the range its owning package declares, so both resolve the same instance. Its `CHECKS` array currently holds one entry (`conversationalist` against `@lostgradient/chat`); it does not check peer-range satisfaction generally.                 |
| `bun run lint`           | `prettier --check` + `eslint`.                                                                                                                                                                                                                                                                                 |
| `bun run format`         | `prettier --write`.                                                                                                                                                                                                                                                                                            |
| `bun run test:e2e`       | Installs Playwright browsers and runs the e2e suite (builds + previews the app first, and runs a dev server alongside it so hydration mismatches are observable).                                                                                                                                              |
| `bun run test`           | Alias for `test:e2e`.                                                                                                                                                                                                                                                                                          |
| `bun run sync:cinder`    | Bumps `@lostgradient/cinder`, `@lostgradient/chat`, `@lostgradient/editor`, `@lostgradient/markdown`, and `armorer` to their latest published versions, then re-verifies (`lint` + `check` + `check:upstream` + `check:peers`; pass `--full` to also run `test:e2e`). Run after an upstream release publishes. |

`prepare` (`svelte-kit sync`) runs automatically after install and doesn't need to be invoked directly.

## Skills

- **`sync-cinder`** (`.claude/skills/sync-cinder/`): wraps `bun run sync:cinder`. Trigger with "sync cinder," "update cinder," or after confirming a filed cinder issue/PR merged **and published**.
- **`review-board`** (`.claude/skills/review-board/`): convenes the four adversarial reviewers that must each return PASS before any work here is complete. See [CLAUDE.md](./CLAUDE.md#the-adversarial-review-board).

## Known upstream friction

Tracked upstream issues against Cinder and agent-bureau — see [CLAUDE.md](./CLAUDE.md#known-upstream-friction) for the current list and filing convention. File owned-package work in its Linear team first (`CIN` for Cinder packages and `AB` for agent-bureau), with a native `blocked by` relation to the affected chatroom work; use `gh issue create` only when the owning repository has no Linear team. Run `bun run check:upstream` to see whether any referenced issue has since closed.

## Coverage roadmap

[ROADMAP.md](./ROADMAP.md) tracks what these components still need exercised, with acceptance criteria per item.
