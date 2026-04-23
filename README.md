# cinder

A Svelte 5 design system.

**Phase 1 status**: the plugin + packaging contract + one example component (`Button`) are in place. Components from `../weft` and `../depict` get ported in Phase 2, the playground lands in Phase 3, static-analysis-driven controls in Phase 4. See `~/.claude/plans/svelte-5-we-can-ethereal-hedgehog.md` for the full multi-phase plan.

## Consuming cinder

```bash
bun add cinder
# or
npm install cinder
```

```svelte
<!-- routes/+page.svelte -->
<script lang="ts">
  import { Button } from 'cinder';
  import type { ButtonVariant } from 'cinder';
  import 'cinder/styles';

  const variants: ButtonVariant[] = ['primary', 'secondary', 'danger', 'ghost'];
</script>

{#each variants as variant (variant)}
  <Button {variant} label={variant} />
{/each}
```

### Export conditions

| Condition | Target                  | Consumer type                                                 |
| --------- | ----------------------- | ------------------------------------------------------------- |
| `svelte`  | `src/index.ts` (source) | Vite / SvelteKit — compiles against consumer's Svelte runtime |
| `types`   | `dist/index.d.ts`       | TypeScript type resolution                                    |
| `node`    | `dist/server/index.js`  | Plain Node SSR via `svelte/server`'s `render()`               |

There is no `browser` or `default` condition in Phase 1. A compiled-client path ships in Phase 5 with its own consumer fixture.

### Peer-dependency policy

`peerDependencies: { "svelte": ">=5.55.0 <5.56.0" }`

cinder's compiled server output is coupled to the Svelte minor it was built against. Every cinder release pins exactly one Svelte minor. When Svelte ships a new minor, cinder bumps its own minor in lockstep. Consumers pinning an earlier Svelte use an earlier cinder.

### Styles

`import 'cinder/styles'` once, anywhere. It loads a cascade-layer stack:

```
@layer cinder.tokens, cinder.foundation, cinder.components, cinder.utilities;
```

- **Classes** use the `.cinder-*` prefix: `.cinder-button`, `.cinder-sr-only`.
- **Variants** use `data-cinder-*` attributes: `data-cinder-variant`, `data-cinder-size`, `data-cinder-loading`.
- **Design tokens** use the `--cinder-*` prefix for the public surface and `--_cinder-*` for internal-only custom properties.

Consumers override tokens by redeclaring them on `:root` or a scoped selector. The foundation reset uses `:where()` for zero specificity, so consumer element styles always win on specificity alone.

Live-browser cascade verification (override-wins-over-internal) is explicitly a Phase 5 concern and is not tested in Phase 1.

## Working on cinder

### Environment

- **Bun >= 1.3.0**: pinned in `engines.bun`. Runtime, bundler, test runner, package manager.
- **Node >= 22**: required for `bun run validate:consumer`, which verifies the `"node"` export condition under actual Node (not Bun).
- **Git**: for the commit-workflow simulation in `bun run validate:workflow`.

### Scripts

```bash
bun install                 # install dependencies
bun run build               # Bun.build server + svelte2tsx .d.ts + tsc declarations → dist/
bun run typecheck           # tsc --noEmit + svelte-check
bun run lint                # oxlint
bun run test                # bun test (plugin smoke + AST enforcement)
bun run validate:workflow   # seed isolated tmp repo, run real lint-staged config on .svelte/.css/.ts
bun run validate:consumer   # build → pack → tarball inspection → sveltekit-consumer + node-consumer
bun run validate            # lint + typecheck + test + validate:workflow + validate:consumer
```

The three validation layers are orthogonal: layer 1 (`bun test`) catches plugin / AST regressions in under a second; layer 2 (`validate:workflow`) catches config drift that would break commits; layer 3 (`validate:consumer`) catches packaging breakage (bad exports, missing files, declaration mismatches, SSR failures) by testing a packed tarball against two real consumer projects.

### Running `.svelte`-importing scripts with `bun run`

Only `bun test` auto-loads the Svelte plugin (via `[test] preload` in `bunfig.toml`). Ad-hoc scripts under `bun run` need the flag explicitly:

```bash
bun --preload ./scripts/preload.ts run my-ad-hoc-script.ts
```

`scripts/build.ts` doesn't need the preload because it imports `sveltePlugin` directly and passes it to `Bun.build`. Most scripts you write in this repo will follow that pattern — the `--preload` form is only for one-off scripts that import `.svelte` source and don't do their own plugin registration.

### Authoring conventions

Component files live as flat `.svelte` under `src/components/`. Every component must:

- Use `<script lang="ts" module>` to export its `Props` type (and any `Variant`/`Size` literal unions) with JSDoc on each.
- Use `$props()` destructuring with defaults and/or type annotations per destructured prop. The Phase 4 analyzer reads names + defaults straight off the destructuring AST.
- Type `Snippet` children as `Snippet` or `Snippet<[...]>` — never as a bare function.
- Use `$bindable(literal)` defaults (so analyzer can extract the default mechanically).
- Carry **no `<style>` block**. The plugin throws at compile time if it sees one; an AST test catches attempts to work around the plugin.
- Style via `.cinder-<name>` in a dedicated partial under `src/styles/components/<name>.css` (aggregated into `components.css`).
- Merge a `class?: string` prop via `classNames()` from `src/utilities/class-names.ts`.

## Packaging layout

After `bun run build`:

```
dist/
├── index.d.ts                         (tsc declarations for the barrel)
├── server/                            ("node" export target)
│   ├── index.js
│   └── components/button.js
└── components/button.svelte.d.ts      (svelte2tsx output — preserves .svelte extension)
```

The published tarball (`bun pm pack`) contains `dist/`, `src/index.ts`, `src/components/`, `src/styles/`, `src/utilities/`, `README.md`. Fixtures, tests, and `scripts/` are excluded. `validate:consumer` asserts both the presence of expected paths and the absence of forbidden ones.

## License

MIT
