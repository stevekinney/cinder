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

| Use this               | Instead of                       |
| ---------------------- | -------------------------------- |
| `margin-inline-start`  | `margin-left`                    |
| `margin-inline-end`    | `margin-right`                   |
| `margin-inline`        | `margin-left` + `margin-right`   |
| `padding-inline-start` | `padding-left`                   |
| `padding-inline-end`   | `padding-right`                  |
| `padding-inline`       | `padding-left` + `padding-right` |
| `border-inline-start`  | `border-left`                    |
| `border-inline-end`    | `border-right`                   |
| `inset-inline-start`   | `left` (when positioning)        |
| `inset-inline-end`     | `right` (when positioning)       |

Block-axis physical properties (`margin-top`, `padding-bottom`, `border-top`, `top`, `bottom`, `width`, `height`) are fine — they don't change under RTL.

Stylelint enforces this on every CSS file and `<style>` block under `packages/*/src/**`. The pre-commit hook will auto-fix where it can and fail the commit otherwise. To run the check locally:

```bash
bun run lint:css           # report
bun run lint:css:fix       # auto-fix what's safe
```

When `left`/`right` carries semantic placement (e.g. `data-placement="left"` selectors on a tooltip), use the rule's `/* stylelint-disable-next-line csstools/use-logical */` escape hatch and add a comment explaining why the physical axis is intentional.

[logical-properties]: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_logical_properties_and_values

## Tests

- Unit tests use `bun:test` and live alongside the source as `*.test.ts`.
- Component browser tests live in `packages/testing` and run under Playwright (`bun run test:browser`).
- Every fix should land with a regression test.

## Commits and pull requests

- Conventional commit prefixes (`feat`, `fix`, `refactor`, `docs`, `chore`).
- Run `bun run lint && bun run typecheck && bun test` before opening a PR.
- PRs go through the multi-agent committee review before merging.
