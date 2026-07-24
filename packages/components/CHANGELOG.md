# @lostgradient/cinder

## 0.17.0

### Minor Changes

- [#852](https://github.com/stevekinney/cinder/pull/852) [`ffbbb2f`](https://github.com/stevekinney/cinder/commit/ffbbb2f3b6fc9ac8bbb14c598716e49cff72c517) Thanks [@stevekinney](https://github.com/stevekinney)! - Add a controlled, accessible JsonEditor primitive with native textarea editing, parse feedback, and no code-editor bundle dependency.

- [#861](https://github.com/stevekinney/cinder/pull/861) [`caa5b36`](https://github.com/stevekinney/cinder/commit/caa5b36ea46511a8e62f514d89e2f4a5726f9fc9) Thanks [@stevekinney](https://github.com/stevekinney)! - Finish the markdown/editor extraction (Phases 4 and 5 of the package-boundaries plan, see
  `docs/decisions/package-boundaries.md`). This is the breaking-change release train that pays off
  the whole extraction: `@lostgradient/cinder` no longer exposes `./markdown/*`, `./editor/*`, or
  `./commentary/*` at all. Every consumer that used those subpaths must depend on
  `@lostgradient/markdown` or `@lostgradient/editor` directly.

  ## Migration table

  | Removed cinder subpath                                                                    | New home                                                                                                                                                                                                                                            |
  | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `@lostgradient/cinder/markdown` and every `./markdown/*` subpath                          | `@lostgradient/markdown` (same subpath shape, e.g. `./markdown/pipeline` → `@lostgradient/markdown/pipeline`, `./markdown/diff/line-diff` → `@lostgradient/markdown/diff/line-diff`, `./markdown/rendering*` → `@lostgradient/markdown/rendering*`) |
  | `@lostgradient/cinder/editor`, `./editor/component-runtime`, `./editor/test-utilities`    | `@lostgradient/editor/editor`, `@lostgradient/editor/editor/component-runtime`, `@lostgradient/editor/editor/test-utilities`                                                                                                                        |
  | `@lostgradient/cinder/editor/sanitize-html`, `/template-placeholders`, `/template-render` | `@lostgradient/markdown/templates/sanitize-html`, `/template-placeholders`, `/template-render`                                                                                                                                                      |
  | `@lostgradient/cinder/commentary` (root) and every `./commentary/*` subpath               | `@lostgradient/editor` root barrel and its matching subpath (e.g. `./commentary/anchor-decorations` → `@lostgradient/editor/anchor-decorations`, `./commentary/comments` → `@lostgradient/editor/comments`)                                         |

  (`@lostgradient/cinder/diff` and `./diff/line-diff` were already removed in the earlier
  `@lostgradient/markdown` publish — see that changeset. `markdown-editor`, `review-editor`, and
  `diff-viewer` were already removed from cinder in the `@lostgradient/editor` publish — import
  those from `@lostgradient/editor` directly, unchanged by this release.)

  ## What else changed
  - Deleted the generated re-export shim directories `src/markdown/`, `src/editor/`,
    `src/commentary/` and the `derive-upstream-reexports.ts` / `CINDER_KEY_OVERRIDES` machinery that
    generated them. Cinder's `dist/` no longer vendors `@lostgradient/markdown`'s or
    `@lostgradient/editor`'s compiled output at all.
  - Two retained cinder files depend on `@lostgradient/markdown` directly now —
    `src/utilities/change-tracker.svelte.ts` and `src/components/json-schema-editor/diff-view.svelte`
    import `@lostgradient/markdown/pipeline` and `@lostgradient/markdown/diff/line-diff`.
    `@lostgradient/markdown` moves from a build-only `devDependency` to a real, published
    `dependencies` entry cinder's consumers install transitively — cinder exposes none of its
    subpaths, but genuinely depends on it now.
  - `@lostgradient/editor` is no longer a cinder dependency of any kind (no `devDependency`, no
    runtime dependency) — no retained cinder source imports it.
  - Dropped now-orphaned dependencies empirically verified unused by any retained cinder source:
    the full milkdown/prosemirror peer set (`@milkdown/ctx`, `@milkdown/kit`, `@milkdown/prose`,
    `prosemirror-inputrules`, `prosemirror-model`, `prosemirror-state`, `prosemirror-view`), the
    markdown-pipeline dependency stack (`comlink`, `diff-match-patch`, `hast-util-sanitize`,
    `js-yaml` — moved to a scripts-only `devDependency`, still used by workspace tooling that parses
    CI YAML — `rehype-katex`, `rehype-sanitize`, `rehype-stringify`, `remark-gfm`, `remark-math`,
    `remark-parse`, `remark-rehype`, `remark-stringify`, `unified`, `unist-util-visit`,
    `@types/hast`, `@types/mdast`, `@types/unist`), and `@shikijs/langs` (never imported by name in
    cinder's own source — only a transitive dependency of `shiki` itself). `shiki`,
    `@shikijs/engine-oniguruma`, and `@shikijs/types` are KEPT: cinder's own
    `src/highlighters/shiki/index.ts` imports all three directly.
  - Cinder's published package weight dropped sharply: 3.81 MB packed / 18.71 MB unpacked / 4,498
    files, down from an 8 MB / 32 MB / 5,500-file budget beforehand.
  - Chat's `markdown-preview.svelte` now dynamically imports `@lostgradient/markdown/rendering`
    directly instead of `@lostgradient/cinder/markdown/rendering` — this was the migration
    rehearsal the decision doc called for. `@lostgradient/markdown` joins chat's `peerDependencies`
    (required, not optional — chat always renders through it) and `devDependencies`.

- [#854](https://github.com/stevekinney/cinder/pull/854) [`23a5ebc`](https://github.com/stevekinney/cinder/commit/23a5ebc161be56d1198829fb269372e67f85d5bb) Thanks [@stevekinney](https://github.com/stevekinney)! - Add a flat conditions mode to `InvocationRuleBuilder` for controlled implicit-AND lists without rule-group metadata or controls.

- [#845](https://github.com/stevekinney/cinder/pull/845) [`35732d8`](https://github.com/stevekinney/cinder/commit/35732d8d15240082ccb5d7b4be6d6216a05c40ea) Thanks [@stevekinney](https://github.com/stevekinney)! - Move the Worker-based Markdown rendering API to `@lostgradient/cinder/markdown/rendering/async` so sync-only consumers do not bundle the Worker entry and its dependencies.

- [#855](https://github.com/stevekinney/cinder/pull/855) [`d7ecfc4`](https://github.com/stevekinney/cinder/commit/d7ecfc4cece464edddef9e027ae5176d40313766) Thanks [@stevekinney](https://github.com/stevekinney)! - Expose complete live SchemaForm drafts through `ondraftchange` while preserving seed-only `value` semantics and validated `onsubmit` output.

- [#817](https://github.com/stevekinney/cinder/pull/817) [`fffa0ab`](https://github.com/stevekinney/cinder/commit/fffa0abf2ee41c9cf0a0e100eb5ee99447f5d5f4) Thanks [@stevekinney](https://github.com/stevekinney)! - Expose PayloadInspector depth controls for its composed JsonViewer.

- [#856](https://github.com/stevekinney/cinder/pull/856) [`006641e`](https://github.com/stevekinney/cinder/commit/006641ebfd998a78e0c2d0459b503c750f9a014c) Thanks [@stevekinney](https://github.com/stevekinney)! - Publish `@lostgradient/editor` (Phase 3 of the package-boundaries plan, see
  `docs/decisions/package-boundaries.md`). `@cinder/commentary` is renamed to `@lostgradient/editor`
  and absorbs the ProseMirror/Milkdown half of the former `@cinder/editor` package. Three components
  move out of `@lostgradient/cinder` and into this new package: `markdown-editor`, `review-editor`,
  and `diff-viewer` — `review-editor` composes the other two, so all three had to move together.

  `@lostgradient/cinder`'s `markdown-editor`, `review-editor`, and `diff-viewer` subpaths (and their
  `/schema`, `/variables`, `/styles`, `/examples` siblings) are **removed** — this is a breaking
  change for any external consumer of those subpaths, hence the minor (not patch) bump on
  `@lostgradient/cinder`, which pre-1.0 treats a breaking removal as a minor per semver's own
  pre-1.0 carve-out (the same reasoning `@lostgradient/markdown`'s publish used for the removed
  `./diff` aliases). That is the ONLY subpath removal in this release — Phase 3's scope is those
  three Svelte components, nothing else. Cinder's `./editor`, `./editor/component-runtime`,
  `./editor/test-utilities`, the bare `./commentary` root barrel, and every `./commentary/*` subpath
  (`anchor-decorations`, `anchoring`, `comments`(+`/types`), `export`(+`/types`), `session`
  (+`/types`), `shared/anchor-types`) are unaffected — they now mirror `@lostgradient/editor`'s
  headless runtime instead of `@cinder/commentary`'s, with no change to their public shape.

  We evaluated re-exporting the three Svelte components back through Cinder as generated shims (the
  `derive-upstream-reexports.ts` / `CINDER_KEY_OVERRIDES` pattern used for the headless subpaths
  above), but that mechanism only understands `.ts` value/type re-exports — `generate-exports.ts`'s
  component pipeline requires a component to physically live under
  `packages/components/src/components/`, and cannot re-export a compiled `.svelte` file from a
  sibling package. A hand-authored shim `.svelte` file was rejected too: it is exactly the kind of
  compatibility scaffolding this repo's conventions avoid on a pre-release package, and Phase 5 of
  the package-boundaries plan deletes Cinder's remaining shims outright — so a temporary
  `markdown-editor`/`review-editor`/`diff-viewer` shim here would be written only to be deleted in
  the very next phase. Consumers of these three components should migrate their import specifier
  from `@lostgradient/cinder/<component>` to `@lostgradient/editor/<component>` directly.

  `@lostgradient/editor`'s peers are `@lostgradient/cinder` (`^0.17.0`), `@lostgradient/markdown`
  (`^0.1.0`), `svelte`, and the milkdown/prosemirror stack — all host-supplied singletons. Its only
  regular `dependencies` are `@floating-ui/dom` and `esm-env`, matching `@lostgradient/cinder`'s own
  treatment of those same two vendored utilities (see `package-boundary.test.ts`): small, stateless
  libraries where a duplicate copy across the install graph causes no functional issue, unlike the
  singleton-sensitive peers above.

- [#806](https://github.com/stevekinney/cinder/pull/806) [`1b80249`](https://github.com/stevekinney/cinder/commit/1b802498e71f799ceac44becd67fec73f8b7d74c) Thanks [@stevekinney](https://github.com/stevekinney)! - Publish `@lostgradient/markdown` (Phase 2 of the package-boundaries plan, see
  `docs/decisions/package-boundaries.md`). `@cinder/markdown` is renamed to `@lostgradient/markdown`
  and absorbs the former `@cinder/diff` package — its word/line-diff engine is now inlined at
  `@lostgradient/markdown/diff/line-diff` rather than re-exported from a separate workspace package.
  `@cinder/diff` no longer exists. `@lostgradient/markdown` now declares `@shikijs/engine-oniguruma`,
  `@shikijs/langs`, and `@shikijs/types` as its own runtime dependencies (previously these existed
  only as transitive dependencies of `@lostgradient/cinder`, which vendors and re-exports markdown's
  compiled output). `@lostgradient/cinder` keeps declaring all three too: `engine-oniguruma` and
  `types` because cinder's own `./highlighters/shiki` adapter imports them directly, and `langs`
  because cinder's build vendors markdown's `./rendering` pipeline (which lazily loads per-language
  grammars from `@shikijs/langs`) into its own published dist under `./markdown/rendering*`. `shiki`
  itself stays a direct dependency of both packages, as before.
  `@lostgradient/cinder`'s `./markdown/*` re-export shims are unaffected; the top-level `./diff` and
  `./diff/line-diff` cinder aliases (sourced from the now-deleted `@cinder/diff` package) are
  **removed** — `./markdown/diff/line-diff` was already the canonical, actually-used path for every
  in-repo consumer, but this is a breaking change for any external consumer of those aliases, hence
  the minor (not patch) bump on `@lostgradient/cinder`, which pre-1.0 treats a breaking removal as a
  minor per semver's own pre-1.0 carve-out. `@cinder/commentary`'s `workspace:*` dependency on
  markdown is repointed to the new package name. `@lostgradient/chat`'s `peerDependencies` on
  `@lostgradient/cinder` widens from `^0.16.0` to `^0.16.0 || ^0.17.0` — cinder's minor bump here
  would otherwise leave chat's declared peer range unsatisfied against the version this release
  actually produces, per `.changeset/README.md`'s "keep that peer range aligned with the Cinder
  version released alongside it" contract.

- [#829](https://github.com/stevekinney/cinder/pull/829) [`4376c18`](https://github.com/stevekinney/cinder/commit/4376c18e2f0dd055ec629cd02035447f8f6e13b2) Thanks [@stevekinney](https://github.com/stevekinney)! - Remove the `brand` snippet from `Sidebar`. Consumers that used it should move that markup into their own shell chrome, such as a top bar or a region above `Sidebar`; there is no replacement API.

- [#823](https://github.com/stevekinney/cinder/pull/823) [`2174be0`](https://github.com/stevekinney/cinder/commit/2174be0182d834d8aa3f1dbe82a2b3fe54b153db) Thanks [@stevekinney](https://github.com/stevekinney)! - Add RunStepTimeline selected-step and row-click selection props.

- [#853](https://github.com/stevekinney/cinder/pull/853) [`31fd201`](https://github.com/stevekinney/cinder/commit/31fd20103079bc6cebeadab8c0e11390119754f3) Thanks [@stevekinney](https://github.com/stevekinney)! - Add a domain-neutral `timed-out` terminal status to RunStepTimeline with a distinct label, danger tone, public schema support, and consumer mapping guidance.

### Patch Changes

- [#832](https://github.com/stevekinney/cinder/pull/832) [`fdecd5e`](https://github.com/stevekinney/cinder/commit/fdecd5e63a0ea2e3ca8e3d997efa3f815d1bd664) Thanks [@stevekinney](https://github.com/stevekinney)! - Keep shared local validation gate waiters alive while the recorded lock holder process is still running.

- [#851](https://github.com/stevekinney/cinder/pull/851) [`955adb0`](https://github.com/stevekinney/cinder/commit/955adb0459272b9d08ed8a5eb13b579ce83997a7) Thanks [@stevekinney](https://github.com/stevekinney)! - Avoid nested navigation landmarks when composing Sidebar with SideNavigation.

- [#833](https://github.com/stevekinney/cinder/pull/833) [`30feaa5`](https://github.com/stevekinney/cinder/commit/30feaa509548f436e77c47520d9b49193f76c6f4) Thanks [@stevekinney](https://github.com/stevekinney)! - Fix a `hydration_mismatch` warning on the first SSR load of any Cinder component that renders an icon (including Chat, which renders one unconditionally in its composer toolbar).

  `lucide-svelte` was a loosely-ranged (`>=0.400.0 <1`) `peerDependency`. Cinder's prebuilt server bundle (`dist/server`, resolved via the `node` export condition under SSR) bakes in whatever `lucide-svelte` version was installed in Cinder's own build at publish time. A consuming application's client bundle, however, resolves `lucide-svelte` fresh at whatever version its own package manager picked within that peer range. Lucide periodically redraws icon artwork (different `<path>` counts or coordinates for the same icon name), so any consumer whose installed `lucide-svelte` differs from Cinder's build-time version got structurally different icon markup between the server-rendered HTML and the client's hydrated render — a real, reproducible `[svelte] hydration_mismatch`, confirmed against a real SvelteKit dev server and a real browser.

  `lucide-svelte` is now a pinned, exact-version regular `dependency` of `@lostgradient/cinder` instead of a peer, so its own server and client builds resolve the same `lucide-svelte` install without depending on what version — if any — your application installs for its own icons. (See the known follow-up below for the one case this does not fully close.)

  **Consumer impact:** if your app currently lists `lucide-svelte` as a direct dependency solely to satisfy `@lostgradient/cinder`'s former peer requirement, you can remove it — Cinder now supplies its own pinned copy for its own components. If your app also renders Lucide icons directly, keep your own dependency; npm/bun will install and resolve it independently of Cinder's pinned copy (they do not conflict).

  **Known follow-up:** if your application pins its _own_ `lucide-svelte` version and your bundler's deduplication happens to collapse Cinder's nested pinned copy onto your application's version for Cinder's client-side (browser/`svelte` condition) source compile — while Cinder's prebuilt `dist/server` still resolves its own pinned copy — the two could still diverge. This is inherent to Cinder shipping both prebuilt server output and raw source for Svelte-aware bundlers. Closing that residual case fully would mean vendoring icon path data directly into Cinder rather than depending on `lucide-svelte` at all; that is out of scope for this fix and is tracked as a follow-up.

  **Known caveat — `lucide-svelte`'s own declared peer range:** every published `lucide-svelte` release, including the latest (`1.0.1` as of this writing), declares `peerDependencies: { svelte: "^3 || ^4 || ^5.0.0-next.42" }` — it has never been updated to include a stable Svelte 5 release, even though it works correctly with one (this repository has used `lucide-svelte@0.503.0` against stable Svelte `5.56.x` for a long time). This is not something this fix can work around by choosing a different `lucide-svelte` version, since none of them declare a stable-Svelte-5 peer range. Under npm/bun's default (non-strict) peer resolution this only produces a warning, same as it did when `lucide-svelte` was Cinder's own peer dependency. Consumers using `pnpm` or `npm --strict-peer-deps` may see this warning surface from inside Cinder's dependency tree now rather than from their own top-level install; if it blocks your install, an `overrides`/`resolutions` entry or a peer-dependency-rule exception for `lucide-svelte` in your package manager's config resolves it, same as it would have before this change.

- [#821](https://github.com/stevekinney/cinder/pull/821) [`f86e857`](https://github.com/stevekinney/cinder/commit/f86e8577f03cedad95858f5fb60a20f3265a2407) Thanks [@stevekinney](https://github.com/stevekinney)! - Add an `allowedModes` prop to `ScheduleBuilder` so consumers can restrict the authoring UI, including cron-only rendering with `allowedModes={['cron']}` that never emits interval values.

- [#805](https://github.com/stevekinney/cinder/pull/805) [`204928e`](https://github.com/stevekinney/cinder/commit/204928e8b07e6e1e7ea7f16c994ae3e201933bf9) Thanks [@stevekinney](https://github.com/stevekinney)! - Deferred `ajv` in `json-schema-editor` the same way `schema-form` already does, so meta-schema validation and compile checks no longer ship Ajv in the base install path. `applyJsonDraft` is now async as a result.

  Moved `zod` and `@modelcontextprotocol/sdk` from `dependencies` to optional `peerDependencies` — both are only used by the `mcp` CLI command (`bin.cinder mcp`), not by any component, so every consumer no longer has to install them. Running `mcp` without them now fails with an actionable message instead of a raw module-resolution error.

- [#793](https://github.com/stevekinney/cinder/pull/793) [`62a9a75`](https://github.com/stevekinney/cinder/commit/62a9a75c321303f7f4c8cd8d429fc0d1a071f667) Thanks [@stevekinney](https://github.com/stevekinney)! - Internal reshuffle: dissolve the private `@cinder/editor` workspace package (Phase 1 of the
  package-boundaries plan, see `docs/decisions/package-boundaries.md`). The headless
  template-placeholder trio (`sanitize-html.ts`, `template-placeholders.ts`, `template-render.ts`,
  `placeholder-security.ts`) moved into `@cinder/markdown`'s new `templates/` directory. The
  ProseMirror/Milkdown editor integration moved into `@cinder/commentary`'s new `editor/`
  directory. `@lostgradient/cinder`'s published `./editor/*` subpaths are unaffected — the
  generated re-export shims now source from the new locations, but the exported symbol sets and
  `package.json#exports` entries are byte-identical to before. Pure internal code movement; no
  public API change.

- [#819](https://github.com/stevekinney/cinder/pull/819) [`0ef0a27`](https://github.com/stevekinney/cinder/commit/0ef0a272568e716e0dac034e60347f5cf3f611d6) Thanks [@stevekinney](https://github.com/stevekinney)! - Add `triggerLabel` to `FileUpload` so consumers can customize the visible picker button text while keeping Cinder's native input wiring, drag-and-drop validation, disabled state, and live-region announcements.

- [#820](https://github.com/stevekinney/cinder/pull/820) [`e9c1146`](https://github.com/stevekinney/cinder/commit/e9c11464ca1ef5af0801439270f4e0e09411ad41) Thanks [@stevekinney](https://github.com/stevekinney)! - Route `ToastRegion` warning toasts through the polite `role="status"` live-region channel while keeping danger toasts assertive.

- [#802](https://github.com/stevekinney/cinder/pull/802) [`280ba3e`](https://github.com/stevekinney/cinder/commit/280ba3e9eed6e76d7534bd0f4f78ff8890cf05df) Thanks [@stevekinney](https://github.com/stevekinney)! - Fix the Shiki adapter behind `<CodeBlock>` (`highlighters/shiki`) to build on `shiki/core` + `@shikijs/engine-oniguruma`, resolving languages and themes through `shiki/langs` / `shiki/themes` instead of the default `shiki` barrel, converging on the same pattern `packages/markdown` already uses. This closes a build-time regression risk: cinder's own build (`splitting: false`) previously kept only the bare `shiki` specifier external, so any future `shiki/*` subpath import would have been inlined whole into cinder's published dist (measured at ~10 MB). `scripts/build.ts` now externalizes `shiki/*` and `@shikijs/engine-oniguruma` too. No change to the public `shikiHighlighter()` API, behavior, or supported language/theme set — and no change to what a consumer's own bundler ships, since `shiki` was already external there.

- [#822](https://github.com/stevekinney/cinder/pull/822) [`7e9d2f6`](https://github.com/stevekinney/cinder/commit/7e9d2f65b1b464762f6858a0e6429c1c6c52d4d1) Thanks [@stevekinney](https://github.com/stevekinney)! - Add a `mobileBreakpoint` prop to Sidebar so app shells can raise or lower the drawer breakpoint while keeping the JavaScript media query and Sidebar presentation contract aligned.

- [#816](https://github.com/stevekinney/cinder/pull/816) [`356c5d7`](https://github.com/stevekinney/cinder/commit/356c5d7f7a4d3a7e9306b71e6039ce05382c7aa7) Thanks [@stevekinney](https://github.com/stevekinney)! - Keep Tabs triggers single-line inside scrollable tab lists, so overflow resolves by horizontally scrolling the tab strip instead of shrinking and wrapping individual tab labels.

- [#798](https://github.com/stevekinney/cinder/pull/798) [`282b380`](https://github.com/stevekinney/cinder/commit/282b38060b765340a58f07487c53a0f9710d4033) Thanks [@stevekinney](https://github.com/stevekinney)! - Thinned `pre-push` to a fast, fail-open sanity check (no more local lint/typecheck/test dispatch or gate lock) now that PR CI and required branch-protection status checks own that validation. No published runtime behavior changes — this only touches internal `scripts/husky/*` tooling and `check-pipeline-coverage.ts`'s declaration table.

- [#792](https://github.com/stevekinney/cinder/pull/792) [`88d8b17`](https://github.com/stevekinney/cinder/commit/88d8b17d99e74742d0819094b3c6a5740079d6c3) Thanks [@stevekinney](https://github.com/stevekinney)! - Teach `check:pipeline-coverage` and `validate:release-workflow` to recognize `turbo run <task>` (including repeated `--filter=<pkg>` flags) as equivalent to `bun run --filter=<pkg> <task>`, so the workspace's move to Turborepo-orchestrated build/test/typecheck/lint doesn't silently blind the CI-gate coverage map. No published runtime behavior changes — dev-tooling scripts only.

- [#841](https://github.com/stevekinney/cinder/pull/841) [`09bdd26`](https://github.com/stevekinney/cinder/commit/09bdd2627ef2a36edf502add662ffd08a9b6ae41) Thanks [@stevekinney](https://github.com/stevekinney)! - Keep horizontal BarChart category labels visible without sacrificing the plot area.

- Updated dependencies [[`62a9a75`](https://github.com/stevekinney/cinder/commit/62a9a75c321303f7f4c8cd8d429fc0d1a071f667), [`1b80249`](https://github.com/stevekinney/cinder/commit/1b802498e71f799ceac44becd67fec73f8b7d74c)]:
  - @lostgradient/markdown@0.1.0

## 0.16.1

### Patch Changes

- [#766](https://github.com/stevekinney/cinder/pull/766) [`01cfe20`](https://github.com/stevekinney/cinder/commit/01cfe20711569effdd5643c3b985603a1536f7df) Thanks [@stevekinney](https://github.com/stevekinney)! - Add a first-class scrollable wrapper option to the compositional Table API.

## 0.16.0

### Minor Changes

- [#760](https://github.com/stevekinney/cinder/pull/760) [`a373800`](https://github.com/stevekinney/cinder/commit/a373800445a0b11e4b6d84b94d5167999b071879) Thanks [@stevekinney](https://github.com/stevekinney)! - Extract the Chat component into the peer-dependency-only `@lostgradient/chat` package and remove it from Cinder's core package exports.

## 0.15.0

### Minor Changes

- [#757](https://github.com/stevekinney/cinder/pull/757) [`792a36d`](https://github.com/stevekinney/cinder/commit/792a36dcf267dcc3f5362f2716b5ab8060b34b5b) Thanks [@stevekinney](https://github.com/stevekinney)! - Improve Chat dependency ownership, streaming exports, and automatic component CSS imports.

### Patch Changes

- [#759](https://github.com/stevekinney/cinder/pull/759) [`278ed74`](https://github.com/stevekinney/cinder/commit/278ed74bc6125daa4be3fdfaaa41c78114c6d009) Thanks [@stevekinney](https://github.com/stevekinney)! - Fix Chat SSR hydration stability for empty conversations.

## 0.14.0

### Minor Changes

- [#747](https://github.com/stevekinney/cinder/pull/747) [`fd1f5dc`](https://github.com/stevekinney/cinder/commit/fd1f5dcc73f279450523deae2b4aed3641581cb7) Thanks [@stevekinney](https://github.com/stevekinney)! - Add SelectableRow with a native primary button or link and independent trailing actions.

### Patch Changes

- [#748](https://github.com/stevekinney/cinder/pull/748) [`f2d7f43`](https://github.com/stevekinney/cinder/commit/f2d7f43b054aee08e57ddc477cc6b5473ba6655b) Thanks [@stevekinney](https://github.com/stevekinney)! - Keep published Svelte source and server bundles on the same scoped-style identity so SSR component trees hydrate without mismatches.

## 0.13.0

### Minor Changes

- [#740](https://github.com/stevekinney/cinder/pull/740) [`ddefe5c`](https://github.com/stevekinney/cinder/commit/ddefe5c7fb2beff3b2593ea1179cc1bb6ed56bae) Thanks [@stevekinney](https://github.com/stevekinney)! - Add link-backed SegmentedControl navigation options for route filters.

## 0.12.1

### Patch Changes

- [#737](https://github.com/stevekinney/cinder/pull/737) [`3600db8`](https://github.com/stevekinney/cinder/commit/3600db878c53ae5d7048487207b08a60d5421b22) Thanks [@stevekinney](https://github.com/stevekinney)! - Publish the post-0.12 downstream fixes for Chat full-height layout metadata and dense inspector styling hooks.

## 0.12.0

### Minor Changes

- [#721](https://github.com/stevekinney/cinder/pull/721) [`a6ee978`](https://github.com/stevekinney/cinder/commit/a6ee9784198ff450c1a9493e3c52a2f2c0965b62) Thanks [@stevekinney](https://github.com/stevekinney)! - Add public source-excerpt styling variables to CodeBlock, typed confirmation to ConfirmDialog, and a facet-only mode to FacetedFilterBar.

### Patch Changes

- [#725](https://github.com/stevekinney/cinder/pull/725) [`a2a3254`](https://github.com/stevekinney/cinder/commit/a2a3254df455b37f74abf4f73e8e8030017af309) Thanks [@stevekinney](https://github.com/stevekinney)! - Render compensation steps directly beneath the forward-step subtree they reverse.

## 0.11.0

### Minor Changes

- [#717](https://github.com/stevekinney/cinder/pull/717) [`28ddb39`](https://github.com/stevekinney/cinder/commit/28ddb39dd9ca9014bf93c71e4bbe401e304773b8) Thanks [@stevekinney](https://github.com/stevekinney)! - Add a `commitOnSubmit` option to TagInput so native forms can commit a pending draft before submission.

## 0.10.0

### Minor Changes

- [#711](https://github.com/stevekinney/cinder/pull/711) [`6ae21f8`](https://github.com/stevekinney/cinder/commit/6ae21f837f85dd88fd8caf6f3110d80ad950304b) Thanks [@stevekinney](https://github.com/stevekinney)! - Add four additive surfaces for coordination and scheduling UIs:
  - **RunStepTimeline** gains branch/coordination groups — a `kind: 'branch'` entry with parallel sub-lanes (`won` / `lost` / `settled` outcomes, winner emphasized, losers muted, collapsible), a per-step `rewound` flag for speculatively-executed-then-unwound steps, and a per-step `compensates` linkage that renders a compensating step inset beneath its forward step with a reversal affordance. Existing `RunStep[]` timelines render unchanged.
  - **ConnectionIndicator** (new) — a standalone live-connection status pill with `connecting` / `live` / `reconnecting` / `polling` / `stale` / `closed` states. `live` pulses (static under reduced motion), `reconnecting` exposes an attempt-count slot, and `polling` reads distinctly quieter than `live`. Status is conveyed by icon + text (never color alone) with a `status` role, and reuses StatusDot's semantic tokens so it composes cleanly beside EventStreamViewer.
  - **ScheduleBuilder** (new) — a date-library-free recurrence control with Presets / Cron / Interval modes behind a SegmentedControl, an always-visible plain-English summary, a "next N fires" preview (computed via an injected `computeNextFires` callback, hidden when absent), and a timezone slot. Emits a discriminated `{ mode: 'cron' | 'interval', ... }` value; presets lower losslessly to one of those two.
  - **InvocationRuleBuilder** gains a conditions-only mode: rules carry conditions with no action target, operators constrained to `eq` / `gt` / `lt` / `gte` / `lte`, and typed value inputs inferred from field type. The existing conditions-plus-actions mode is unchanged and remains the default.

## 0.9.0

### Minor Changes

- [#693](https://github.com/stevekinney/cinder/pull/693) [`124e7b2`](https://github.com/stevekinney/cinder/commit/124e7b2740d8243e434c1eb831e2c760dab6265a) Thanks [@stevekinney](https://github.com/stevekinney)! - Move `conversationalist` from a transitive dependency to a required peer
  dependency. Consumers that use Chat or Cinder's conversation helpers must
  install `conversationalist@^0.2.1` and `zod@4.4.1` directly so the application
  and Cinder share one conversation type/schema instance.

## 0.8.0

### Minor Changes

- [`9686390`](https://github.com/stevekinney/cinder/commit/9686390483ce91eebe82f2f28852e436c1f2724a) Thanks [@stevekinney](https://github.com/stevekinney)! - `Chat` composer public API: added `clearInput()`, `getComposerValue()`, and an `oncomposerinput` callback prop so consumers can read, clear, and observe the composer's plain-text value without reaching into `.chat-input-editor` DOM directly (useful for building slash-command, mention, or autocomplete UX layered on top of the composer).

  Also re-exported the `ChatAttachment` type from the public `@lostgradient/cinder/chat` entry — previously consumers had to derive it from `ChatSubmitEvent['attachments'][number]`.

### Patch Changes

- [#675](https://github.com/stevekinney/cinder/pull/675) [`e55561d`](https://github.com/stevekinney/cinder/commit/e55561db6d348573e29df711c095b2ec18e197ef) Thanks [@stevekinney](https://github.com/stevekinney)! - Close a collapsed top NavigationBar mobile menu after enabled item activation.

- [#667](https://github.com/stevekinney/cinder/pull/667) [`d9ce2c3`](https://github.com/stevekinney/cinder/commit/d9ce2c3660805d8b6a7e964f3f671174c61ca819) Thanks [@stevekinney](https://github.com/stevekinney)! - Internal build and validation overhaul: content-hash build caching (with the cache marker excluded from the published tarball), global test cleanup registration, and a lint script split into `lint` and `lint:invariants`.

## 0.7.0

### Minor Changes

- [#662](https://github.com/stevekinney/cinder/pull/662) [`e7c9eac`](https://github.com/stevekinney/cinder/commit/e7c9eac23f572d5068fb723df96fc17e2443c4ed) Thanks [@stevekinney](https://github.com/stevekinney)! - Raise the Svelte peer dependency floor to 5.56 and fix packed SvelteKit client hydration for public component exports.

### Patch Changes

- [#661](https://github.com/stevekinney/cinder/pull/661) [`96cad34`](https://github.com/stevekinney/cinder/commit/96cad34315a2cc4daa3b6ba53d7622bbb3316436) Thanks [@stevekinney](https://github.com/stevekinney)! - Keep chat server bundles from pulling rich editor and markdown peer dependencies by default.

- [#660](https://github.com/stevekinney/cinder/pull/660) [`cfa3d5d`](https://github.com/stevekinney/cinder/commit/cfa3d5dcc7816a170339bf889276ab309d20288b) Thanks [@stevekinney](https://github.com/stevekinney)! - Fix the published package manifest so Svelte-aware consumers resolve Cinder component source instead of compiled component output, while stripping TypeScript-only syntax from staged Svelte source files so Vite can optimize the package.

- [#663](https://github.com/stevekinney/cinder/pull/663) [`3fc860b`](https://github.com/stevekinney/cinder/commit/3fc860bd9cc3cc3640fbe43def3e1a726a23d3bf) Thanks [@stevekinney](https://github.com/stevekinney)! - Add skipped state support to Steps items.

- [#668](https://github.com/stevekinney/cinder/pull/668) [`ba2a5ba`](https://github.com/stevekinney/cinder/commit/ba2a5baa931b1549b2d4233f6f66c5b35a01e25b) Thanks [@stevekinney](https://github.com/stevekinney)! - Re-export paired component leaves from their parent subpaths and trim duplicate server metadata artifacts from the published package.

## 0.6.0

### Minor Changes

- [#638](https://github.com/stevekinney/cinder/pull/638) [`f0a6ac2`](https://github.com/stevekinney/cinder/commit/f0a6ac23c75a2ee8361f27a67649418452d550c3) Thanks [@stevekinney](https://github.com/stevekinney)! - Move rich editor, markdown rendering, and syntax-highlighting packages out of the base install path. Styles-only and lightweight component consumers no longer install Milkdown, ProseMirror, Shiki, remark, or rehype trees unless they opt into the rich feature surfaces.

  Consumers importing `@lostgradient/cinder/chat` with the default composer, `@lostgradient/cinder/markdown-editor`, `@lostgradient/cinder/review-editor`, `@lostgradient/cinder/markdown`, `@lostgradient/cinder/markdown/*`, `@lostgradient/cinder/editor`, `@lostgradient/cinder/editor/*`, `@lostgradient/cinder/commentary`, `@lostgradient/cinder/commentary/*`, `@lostgradient/cinder/highlighters/shiki`, or relying on `Chat` built-in markdown/tool message rendering or `CodeBlock` automatic highlighting should install the listed optional peer dependencies, including the public markdown AST type packages, for those rich features. `MarkdownEditor` and `ReviewEditor` are now subpath-only imports so the root barrel can stay usable without rich optional peers.

### Patch Changes

- [#646](https://github.com/stevekinney/cinder/pull/646) [`a5dc7c0`](https://github.com/stevekinney/cinder/commit/a5dc7c04cee27f18b20470f3d6edc669fcb9045e) Thanks [@stevekinney](https://github.com/stevekinney)! - Add `ActionRow`, a selectable full-width button row primitive for master-detail lists, timelines, and sidebar selection surfaces.

- [#642](https://github.com/stevekinney/cinder/pull/642) [`a51a733`](https://github.com/stevekinney/cinder/commit/a51a733c8ef7a48719bded3b64c9e876ea2d68e5) Thanks [@stevekinney](https://github.com/stevekinney)! - Keep the collapsible NavigationBar menu toggle grouped with trailing actions on narrow bars.

- [#643](https://github.com/stevekinney/cinder/pull/643) [`5322ca3`](https://github.com/stevekinney/cinder/commit/5322ca376874cf637b8bbb4649aa78b02fedd7e4) Thanks [@stevekinney](https://github.com/stevekinney)! - Add SourceDiffViewer for bounded, accessible unified source patches.

## 0.5.0

### Minor Changes

- [#547](https://github.com/stevekinney/cinder/pull/547) [`68a194d`](https://github.com/stevekinney/cinder/commit/68a194df6fcb7a588cb10ff61a06f3252a091df3) Thanks [@stevekinney](https://github.com/stevekinney)! - Add a new `InlineLoading` component for inline async-action lifecycle feedback (`inactive | active | finished | error`), with `description`, `iconDescription`, and `successDelay` props, polite live-region announcements, and auto-reset from `finished` back to `inactive`.

- [#546](https://github.com/stevekinney/cinder/pull/546) [`0f68943`](https://github.com/stevekinney/cinder/commit/0f6894361f609b99625d8217772f528c33a3f7d4) Thanks [@stevekinney](https://github.com/stevekinney)! - Add the new `TableOfContents` component export, styles, schema, and examples to `@lostgradient/cinder`.

- [#545](https://github.com/stevekinney/cinder/pull/545) [`2c080cb`](https://github.com/stevekinney/cinder/commit/2c080cb77f7b6a6b3c9296adb553e335aa4f1b2b) Thanks [@stevekinney](https://github.com/stevekinney)! - Add new `QrCode` and `Marquee` components, including generated schemas/examples metadata and public exports.

- [#541](https://github.com/stevekinney/cinder/pull/541) [`423f785`](https://github.com/stevekinney/cinder/commit/423f785027dc03d261b72107cd67a8f138c2e77d) Thanks [@stevekinney](https://github.com/stevekinney)! - Add a new `Meter` component for bounded measurements with `role="meter"` semantics, threshold-aware state mapping, generated docs/schema artifacts, and playground examples.

- [#543](https://github.com/stevekinney/cinder/pull/543) [`76516b8`](https://github.com/stevekinney/cinder/commit/76516b85660f084d5002c0f10a8c86800a47cd83) Thanks [@stevekinney](https://github.com/stevekinney)! - Add the new `BentoGrid` layout primitive with `BentoGrid.Cell`/`BentoCell` support for asymmetric span mosaics, plus generated docs/schema artifacts and playground examples.

### Patch Changes

- [#641](https://github.com/stevekinney/cinder/pull/641) [`ec89bc1`](https://github.com/stevekinney/cinder/commit/ec89bc11) Thanks [@stevekinney](https://github.com/stevekinney)! - **Breaking CSS utility rename:** the icon sizing helpers exported from `@lostgradient/cinder/styles` and `@lostgradient/cinder/styles/utilities` are now namespaced as `.cinder-icon-xs`, `.cinder-icon-sm`, `.cinder-icon-md`, and `.cinder-icon-lg`. Cinder components use the namespaced utilities internally so application-level `.icon-*` classes cannot change component icon sizing. Consumer markup that used `.icon-xs`, `.icon-sm`, `.icon-md`, or `.icon-lg` should rename those classes to the matching `.cinder-icon-*` class.

- [#559](https://github.com/stevekinney/cinder/pull/559) [`9628078`](https://github.com/stevekinney/cinder/commit/96280780a150a69f74a3abfa60d9006fd2be3c6c) Thanks [@stevekinney](https://github.com/stevekinney)! - Align Chat's conversation model with the published `conversationalist` package instead of maintaining bespoke mirrored transcript types.

- [#577](https://github.com/stevekinney/cinder/pull/577) [`f4a9386`](https://github.com/stevekinney/cinder/commit/f4a938605a20ff0fdfe401f43db32248930af0e5) Thanks [@stevekinney](https://github.com/stevekinney)! - Preserve server component identity in the published SSR bundle so SvelteKit development SSR can render Cinder snippet content without crashing. Fixes [#572](https://github.com/stevekinney/cinder/issues/572) and [#573](https://github.com/stevekinney/cinder/issues/573).

- [#579](https://github.com/stevekinney/cinder/pull/579) [`a7be36a`](https://github.com/stevekinney/cinder/commit/a7be36ae001ffff5b81b7c134ccb2b01c177e526) Thanks [@stevekinney](https://github.com/stevekinney)! - Remove an unused transitive dependency that produced TypeScript 6 peer warnings, and strengthen consumer validation to assert TypeScript 6 install compatibility.

- [#542](https://github.com/stevekinney/cinder/pull/542) [`3c0f267`](https://github.com/stevekinney/cinder/commit/3c0f267db9895a1797f761eb8b2cac83af23ecca) Thanks [@stevekinney](https://github.com/stevekinney)! - Add the new public `@lostgradient/cinder/multi-select` export with its docs/examples artifacts.

- [#544](https://github.com/stevekinney/cinder/pull/544) [`a9ee834`](https://github.com/stevekinney/cinder/commit/a9ee834c882246414a2bb610886762e6a62311b4) Thanks [@stevekinney](https://github.com/stevekinney)! - Add Carousel, Footer, and MegaMenu as public components with generated exports,
  styles, docs artifacts, and playground examples.

## 0.4.1

### Patch Changes

- [#535](https://github.com/stevekinney/cinder/pull/535) [`fb757d1`](https://github.com/stevekinney/cinder/commit/fb757d1afb82f85457800ba0bb1561906c1a93ce) Thanks [@stevekinney](https://github.com/stevekinney)! - Fix Node SSR export condition precedence so resolvers with both `node` and `svelte` active load compiled server artifacts instead of source entries.

## 0.4.0

### Minor Changes

- [#524](https://github.com/stevekinney/cinder/pull/524) [`680c499`](https://github.com/stevekinney/cinder/commit/680c499a8822882693f387f93f0eab9c086a12b8) Thanks [@stevekinney](https://github.com/stevekinney)! - Add the alpha ApprovalCard component for durable human-in-the-loop tool approvals.

- [#475](https://github.com/stevekinney/cinder/pull/475) [`9349f11`](https://github.com/stevekinney/cinder/commit/9349f11e71874b3056f59a68609eb705ed185aca) Thanks [@stevekinney](https://github.com/stevekinney)! - Remove write-back $effects from rating, pin-input, chat, and image-lightbox; fix schema-form schema-change reset.

  **No-write-back contract for rating and pin-input.** The `value` bindable in `Rating` and `PinInput` is no longer mutated back to the normalized/filtered value. The displayed and submitted value is derived internally via `$derived`, but the bound prop reflects exactly what the consumer set. Consumers relying on the binding being silently normalized should read from `onchange` instead.

  **Chat scroll/unread bindables now update via explicit callbacks.** The `isAtBottom`, `unreadCount`, and `hasNewMessageIndicator` bindables are maintained through the existing `onscrollstatechange`, `onunreadindicatorchange`, and `onReachBottom` callback paths — no $effect write-back. The `handleSubmit` path now also writes `isAtBottom = true` after `scrollState.setIsAtBottom(true)` so the binding stays current after the user sends a message.

  **SchemaForm schema-change now genuinely resets form state.** The internal form body has been extracted into a child component (`schema-form-body.svelte`). The outer component renders `{#key schema}<SchemaFormBody />` so that changing `schema` destroys and recreates the child — causing genuine `$state` recreation (formValue, errors, rawDrafts, arrayKeys, serializedValue) rather than only DOM reconciliation. Changing `value` with the same schema does NOT reset the form (seed-only contract, documented on the prop).

  **image-lightbox index reset.** The `previousOpen $state + $effect` write-back is replaced by a `navigationIndex` (null = no navigation yet) with `effectiveIndex = $derived(navigationIndex ?? clampedInitialIndex)`. Calling `close()` resets `navigationIndex` to null so the next open starts at `initialIndex` without any $effect.

- [#473](https://github.com/stevekinney/cinder/pull/473) [`51355f8`](https://github.com/stevekinney/cinder/commit/51355f83cf0d56f7ccaf3bec27a9c2c34d26006a) Thanks [@stevekinney](https://github.com/stevekinney)! - **Breaking: `DataList` now requires a `key` extractor.** `DataListProps.key` was
  optional and silently fell back to an unkeyed `{#each}` block when omitted, which
  made a stable data-display primitive use index-based reconciliation for mutable
  lists (O(n) row churn and incorrect row instance reuse on insert/remove/filter/
  reorder). `key` is now required and the unkeyed fallback is removed. Consumers
  that omitted `key` must pass a stable extractor, e.g. `key={(item) => item.id}`.

  **Breaking: `Masonry.as` is narrowed to a layout-safe element union.** `as` was
  typed as any `string`, allowing void elements (`img`, `input`, `br`, `hr`) that
  cannot validly contain masonry children. It now accepts a `MasonryElement` union
  (`article | aside | div | footer | header | main | nav | section | ul | ol`).

- [#520](https://github.com/stevekinney/cinder/pull/520) [`7b0baa4`](https://github.com/stevekinney/cinder/commit/7b0baa4667907744d56973d49411edc6370e346d) Thanks [@stevekinney](https://github.com/stevekinney)! - Backfill missing component accessibility documentation, gate `.a11y.md` presence in `components:check`, and tighten DataGrid/DataTable audit fixes.

  DataGrid columns can now opt into `role="rowheader"` with `rowHeader: true`, virtualized-column overflow keeps a stable gutter and edge cue, and DataTable sortable headers describe the next sort action while focused rows receive the same hover affordance. The package also normalizes optional Svelte component function parameters so packed source remains valid for downstream SvelteKit consumers.

- [#524](https://github.com/stevekinney/cinder/pull/524) [`680c499`](https://github.com/stevekinney/cinder/commit/680c499a8822882693f387f93f0eab9c086a12b8) Thanks [@stevekinney](https://github.com/stevekinney)! - Add EventStreamViewer reconnect replay markers and advisory sequence-gap markers.

- [#458](https://github.com/stevekinney/cinder/pull/458) [`731784d`](https://github.com/stevekinney/cinder/commit/731784d59ea655a469f596e7de4574e336c35c9b) Thanks [@stevekinney](https://github.com/stevekinney)! - Unify form-control consistency and accessibility, and rebuild `SchemaForm` on the
  real cinder components.

  **Required indicator.** Every form control now renders a visible required marker
  on its own `label`/`legend` — previously the asterisk only appeared when a control
  was wrapped in `FormField`, so `<Textarea required label="…">` silently showed no
  indicator. The marker is a shared, centered red asterisk (`*`, not a color-only
  dot) so the meaning is conveyed by glyph shape (WCAG 1.4.1). Screen readers rely
  on the native `required`/`aria-required` attribute, so there is no double
  announcement. Affects Input, Textarea, Select, NumberInput, Combobox, Autocomplete,
  Checkbox, PinInput, PhoneInput, CheckboxGroup, RadioGroup, FormField, and Label.

  **`SchemaForm` now composes cinder components** (Input, NumberInput, Select,
  Checkbox, Textarea) via Svelte 5 function-bindings instead of rendering raw HTML
  controls. Boolean fields render as a `Checkbox` (a deferred form boolean) rather
  than a bespoke switch. This removes all behavior/style drift between SchemaForm and
  the standalone controls.

  **Consistency fixes.** Combobox now inherits id/`aria-describedby`/`disabled` from a
  wrapping `FormField` and gained a `required` prop. Toggle inherits `disabled` from
  `FormField` context. Input and NumberInput now share the same ARIA resolver as the
  other controls (Input no longer drops a wrapping FormField's describedby id).
  CheckboxGroup sets `aria-required` to match RadioGroup. Select and Textarea labels
  gained their missing class/disabled styling.

  **Breaking changes:**
  - `ColorField`: `ariaLabel` → `aria-label`, `ariaLabelledby` → `aria-labelledby`.
  - `CheckboxGroup` and `RadioGroup`: the `legend` prop is renamed to `label` for
    consistency with every other form control (still rendered as a `<legend>`).

- [#476](https://github.com/stevekinney/cinder/pull/476) [`58072f7`](https://github.com/stevekinney/cinder/commit/58072f7b694a54a1704a7f78b0a0bce86aeff401) Thanks [@stevekinney](https://github.com/stevekinney)! - Idiom & developer-experience cleanups (audit [#468](https://github.com/stevekinney/cinder/issues/468)).

  **Breaking type rename.** `diff-viewer`'s exported `ViewMode` type is renamed to
  `DiffViewerMode` for a self-describing, collision-free public name. There is no
  compatibility alias (per the audit's no-shim requirement) — consumers importing
  `ViewMode` from `@lostgradient/cinder` or `@lostgradient/cinder/diff-viewer` must
  import `DiffViewerMode` instead.

  **Accessibility.** `CheckboxGroup` and `RadioGroup` now emit a development-only
  warning when they render a `<fieldset>` without an accessible group name
  (`<legend>`/label), matching the rest of the form-control suite.

  **Correctness.** The `run-step-timeline` rail uses logical positioning
  (`inset-inline-start`/`inset-block-start`/`inline-size`) so it lays out correctly
  in right-to-left contexts. Several icon-button hit areas were enlarged for touch.

  **Maintenance (no behavior change).** Svelte 4 lifecycle helpers migrated to
  `$effect`, hand-rolled `ResizeObserver` setups moved to the shared
  `useResizeObserver` utility, and `use:`-actions converted to `{@attach}`
  attachments. Form-control `error` props consistently include `undefined`.
  Review-editor types are consolidated into one authoritative module.

- [#477](https://github.com/stevekinney/cinder/pull/477) [`15a46b3`](https://github.com/stevekinney/cinder/commit/15a46b35247473b87beebbb2088795fc3352c9be) Thanks [@stevekinney](https://github.com/stevekinney)! - **Breaking: PascalCase event-callback props renamed to lowercase.** Svelte 5 event
  props use the same lowercase syntax as DOM handler props (`onclick`, `ondismiss`),
  and cinder's convention is all-lowercase. The following public callback props are
  renamed to their lowercase forms across the affected components (alert, banner,
  capability-gate, collapsible, click-away-listener, data-grid, load-more,
  markdown-editor, media-controls, table, table-header, table-row, transfer-list,
  tree, tree-item):

  `onDismiss`→`ondismiss`, `onToggle`→`ontoggle`, `onReorder`→`onreorder`,
  `onPlay`→`onplay`, `onLoadMore`→`onloadmore`, `onSelectedChange`→`onselectedchange`,
  `onSelectionChange`→`onselectionchange`, `onFilterChange`→`onfilterchange`,
  `onPause`→`onpause`, `onReplay`→`onreplay`, `onLoadError`→`onloaderror`,
  `onRename`→`onrename`, `onChange`→`onchange`, `onClickAway`→`onclickaway`,
  `onSortChange`→`onsortchange`, `onSortModelChange`→`onsortmodelchange`,
  `onSelectionModelChange`→`onselectionmodelchange`, `onReady`→`onready`.

  Each renamed callback keeps the same payload arguments and invocation timing. No
  compatibility aliases are provided — update call sites to the lowercase names.

  The stable-promotion `PROP_NAME_DENYLIST` is now compared case-insensitively for
  `on*` props, so a PascalCase event-callback prop can no longer slip past the gate.

- [#524](https://github.com/stevekinney/cinder/pull/524) [`680c499`](https://github.com/stevekinney/cinder/commit/680c499a8822882693f387f93f0eab9c086a12b8) Thanks [@stevekinney](https://github.com/stevekinney)! - Enhance RunStepTimeline with waiting-approval state, nested child lanes, step links, and action counts.

- [#524](https://github.com/stevekinney/cinder/pull/524) [`680c499`](https://github.com/stevekinney/cinder/commit/680c499a8822882693f387f93f0eab9c086a12b8) Thanks [@stevekinney](https://github.com/stevekinney)! - Promote the Stardust agent-operations components based on promotion-gate evidence.

  `EventStreamViewer`, `PayloadInspector`, and `SecretValueField` are now marked stable. `InvocationRuleBuilder` is now marked beta after passing the same readiness gate with tests, accessibility coverage, and prop-name checks passing.

  `SecretValueField` also now uses Svelte's explicit untracked initial-state capture for `initiallyRevealed`, preserving its initial-only behavior while avoiding a local-state warning.

- [#478](https://github.com/stevekinney/cinder/pull/478) [`0302908`](https://github.com/stevekinney/cinder/commit/03029085e54dcc3344d568821e553340f70d17fc) Thanks [@stevekinney](https://github.com/stevekinney)! - **Breaking: unify public API vocabulary across components.** Several public APIs
  used different words for the same concept; this standardizes them. No compatibility
  aliases are provided (per the audit's no-shim requirement) — update call sites.
  - **Severity spelling.** `alert` and `status-dot` drop the `error` value in favor of
    `danger`, the canonical failure-severity spelling already used by `banner` and
    `callout`. Use `variant="danger"` (Alert) / `status="danger"` (StatusDot) instead
    of `"error"`.
  - **Accessible-name props.** `ariaLabel` / `navAriaLabel` are renamed to `label` on
    `sidebar`, `scroll-area`, `navigation-bar`, and `dropdown-group`; `StatChange.ariaLabel`
    becomes `StatChange.label`.
  - **Chat boolean props.** `isAtBottom` → `atBottom`, `hasNewMessageIndicator` →
    `newMessageIndicatorVisible`, `isStreaming` → `streaming`, `hasMoreHistory` →
    `moreHistoryAvailable`. The per-feature `allow*` flags (`allowAttachments`,
    `allowSearch`, `allowCopy`, `allowEditing`, `allowRetry`) are grouped into a single
    `capabilities` object prop.
  - **FloatingActionButton visual API.** `color` → `variant` (the palette) and
    `variant` → `shape` (filled/extended). The exported types rename accordingly:
    `FloatingActionButtonColor` → `FloatingActionButtonVariant` and the old
    `FloatingActionButtonVariant` → `FloatingActionButtonShape`.

  Generated schemas, README tables, examples, and package exports are updated to match.

### Patch Changes

- [#470](https://github.com/stevekinney/cinder/pull/470) [`644a646`](https://github.com/stevekinney/cinder/commit/644a646edccd03cc6f4394c1ed532643101083b0) Thanks [@stevekinney](https://github.com/stevekinney)! - Add `@media (forced-colors: active)` focus-ring fallbacks to nine components whose `:focus-visible` ring relied exclusively on `box-shadow` — which Windows High Contrast Mode (forced-colors) removes. Keyboard focus was invisible in HCM for users of CapabilityGate, KanbanBoard, MediaControls, PermissionMatrix, ShareCard, TransferList, Table, MenuBar, and ChatConversationList.

  Each fallback repaints the outline with `ButtonText` at the correct offset for the control type: `3px` for bordered controls (separates the ring from `ButtonBorder`, which shares the `ButtonText` color family in HCM), `2px` for borderless controls, and an inset `calc(-1 * var(--cinder-ring-width))` for the TransferList scrollable panel (which has `overflow: auto` — a positive offset would be clipped). Each fallback also sets `box-shadow: none` explicitly so forced-colors suppression is unambiguous across engines.

  A new Stylelint rule (`cinder/require-forced-colors-focus-fallback`) is wired into root `.stylelintrc.json` and into the test suite, so any future `:focus-visible` rule that relies on `box-shadow` without a matching forced-colors fallback will fail linting.

## 0.3.0

### Minor Changes

- [#368](https://github.com/stevekinney/cinder/pull/368) [`4e5847e`](https://github.com/stevekinney/cinder/commit/4e5847e7ec6e5960bda464c998c9f2701f29f88c) Thanks [@stevekinney](https://github.com/stevekinney)! - Enrich the component manifest (`components.json`) with structured accessibility metadata and restructure `avoidWhen` guidance.
  - `avoidWhen` entries change from flat strings to `{ reason, alternative? }` objects, where `alternative` is the kebab-case id of the component to reach for instead. Authored as `@avoidWhen <reason> | <kebab-id>` (the alternative is optional). This is a breaking change to the published manifest schema for external consumers that read `avoidWhen`.
  - New optional `a11y` metadata per component (`{ pattern?, keyboard?, notes? }`), authored via `@a11yPattern`, `@keyboardShortcut <keys> | <action>`, and `@a11yNote` JSDoc tags. Components without these tags omit the field entirely.

  The manifest generator now also fails if an `avoidWhen.alternative` does not resolve to a real component id.

- [#439](https://github.com/stevekinney/cinder/pull/439) [`a4a414d`](https://github.com/stevekinney/cinder/commit/a4a414dba7d8a714ea8971c5c7ddd5f30c5f2cbd) Thanks [@stevekinney](https://github.com/stevekinney)! - **Breaking:** Removed `TimelineItem` from the public API. The
  `@lostgradient/cinder/timeline-item` import path (and its `/schema`,
  `/variables`, `/styles` subpaths) and the top-level `TimelineItem` /
  `TimelineItemProps` exports are gone.

  `TimelineItem` is now an internal implementation detail of `Timeline` — compose
  `Timeline` (which renders its items for you) instead of building a rail out of
  bare `TimelineItem`s. The public timeline surface is `Timeline` and
  `RunStepTimeline`, which model distinct domains (an entries-driven event rail vs.
  async run/step state).

- [#428](https://github.com/stevekinney/cinder/pull/428) [`5d0a325`](https://github.com/stevekinney/cinder/commit/5d0a32506b97b51b5955917dda7c2898dceb5d74) Thanks [@stevekinney](https://github.com/stevekinney)! - Retune the color palette around an indigo brand, polish the command-palette and timeline, and remove the previously-deprecated experimental-timeline aliases (a pre-1.0 export-map removal shipping in this minor — see the migration note below).

  **Palette (visible default change for every consumer):**
  - Brand accent is now indigo (hue 270) and carries white labels in light mode. `--cinder-accent` moves to `oklch(50% 0.22 270)` (light) / `oklch(72% 0.14 270)` (dark) and `--cinder-accent-contrast` flips to white in light mode — primary buttons, the active command-palette item, and every solid accent fill show white text on indigo (6.45:1, clears WCAG AA). `--cinder-accent-text` (links/icons) and the focus ring re-hue automatically; the ring's light-arm lightness clamp drops 0.58 → 0.55 so the indigo ring keeps ≥3:1 (WCAG 1.4.11) on near-white surfaces.
  - Info status nudged hue 245 → 230 so the blue "info" state no longer competes with the indigo brand.
  - The 8 categorical chart series are retuned: brand-safe (no hue in 248–292) and strongly distinguishable in normal vision (min CIEDE2000 ΔE00 ≥ 12). Each arm additionally keeps a minimum pairwise CIE L\* separation of ≥ 4 so lightness stays a usable secondary distinguishing channel when hue contrast degrades for color-vision-deficient viewers. The light and dark arms are tuned independently for in-theme contrast and gamut, so a series is not guaranteed the same hue across themes.
  - Status fills (success/warning/danger) refitted to the sRGB gamut — several were authored over-chroma and silently clamped (warning especially). The danger button's hover and active states are now authored explicitly instead of derived by darkening the fill at constant chroma: red sits near the gamut boundary, so the old constant-chroma derivation clamped the pressed/hover states to a duller red than specified. Each light-arm state is now pinned to its in-gamut chroma maximum, so the darkening is both monotonic and exactly rendered (white labels stay ≥ 6.7:1).
  - A new gate, `check-token-contrast.test.ts` (`bun run colors:contrast`), parses the actual token values and asserts WCAG contrast, sRGB-gamut integrity, and chart distinguishability so the palette can't silently regress.

  **Command palette:** the search input no longer carries its own 3px focus ring (it read as a stray floating box around the edgeless input). Keyboard focus is now indicated by the search row's bottom border recoloring to the ring color on `:focus-within`; the border is reserved at 2px at rest so focusing causes no layout shift.

  **Timeline:** the connector line now runs continuously from each marker's center to the next marker's center, instead of leaving stubby gaps that didn't reach the dots. The geometry is derived from the marker's center coordinates — the marker is a fixed-size box (`--_cinder-timeline-marker-size`) that custom `marker` snippets fill rather than resize — so the line meets the dot in the default and custom-marker examples alike. The previous fixed-offset calibration left the line short of the next dot.

  **Migration — removed the previously-deprecated `@lostgradient/cinder/experimental/timeline` and `@lostgradient/cinder/experimental/timeline-item` export paths.** These aliases were deprecated once the stable paths shipped; removing them pre-1.0 ships as a minor (no major bump). Import from `@lostgradient/cinder/timeline` and `@lostgradient/cinder/timeline-item` instead.

- [#367](https://github.com/stevekinney/cinder/pull/367) [`c6764d0`](https://github.com/stevekinney/cinder/commit/c6764d04a42547ee2b788bad41d6b1112a5d650c) Thanks [@stevekinney](https://github.com/stevekinney)! - Add seven operational components for agent/workflow tooling: `FacetedFilterBar`
  ([#352](https://github.com/stevekinney/cinder/issues/352)), `EventStreamViewer` ([#354](https://github.com/stevekinney/cinder/issues/354)), `PayloadInspector` ([#355](https://github.com/stevekinney/cinder/issues/355)), `RunStepTimeline`
  ([#356](https://github.com/stevekinney/cinder/issues/356)), `DateRangeField` ([#357](https://github.com/stevekinney/cinder/issues/357)), `SecretValueField` ([#359](https://github.com/stevekinney/cinder/issues/359)), and
  `InvocationRuleBuilder` ([#360](https://github.com/stevekinney/cinder/issues/360)). Also adds operational-payload examples to
  `JsonViewer` ([#358](https://github.com/stevekinney/cinder/issues/358)).

### Patch Changes

- [#414](https://github.com/stevekinney/cinder/pull/414) [`77ec914`](https://github.com/stevekinney/cinder/commit/77ec91420c5f7fe91b45882e2007a83a0871d619) Thanks [@stevekinney](https://github.com/stevekinney)! - Resolve component-side findings from the keyboard/ARIA accessibility audit ([#382](https://github.com/stevekinney/cinder/issues/382), [#377](https://github.com/stevekinney/cinder/issues/377), [#383](https://github.com/stevekinney/cinder/issues/383)).
  - **`Autocomplete`, `Combobox`, `Dropdown`** — the keyboard-active option in floating lists is now an unambiguous, WCAG 1.4.11-clearing indicator. Two parts: (1) `Autocomplete` previously pinned its active-row background to `--cinder-surface-raised` — the exact token the floating panel uses for its own background — so the highlight disappeared in light mode; that component-local override is removed so the row inherits the shared treatment. (2) The shared `.cinder-_option-row[data-cinder-active]` rule now adds an inset `--cinder-ring-color` keyboard-cursor ring on top of the `--cinder-surface-hover` background. The background tint alone is a deliberately subtle ~1.1:1 step (fine for pointer hover) but fails the 3:1 non-text-contrast floor for the _sole_ keyboard-position indicator; the ring clears it in both themes. The ring is scoped to the keyboard cursor (`data-cinder-active`), keeping it visually distinct from a committed `aria-selected` choice, and falls back to a `forced-colors` `outline: Highlight`. This applies to every floating list built on `.cinder-_option-row` (Autocomplete, Combobox, Dropdown).
  - **`Avatar`** — documented that a placeholder-only avatar (no `src`, no `name`) renders a decorative `aria-hidden` placeholder and has no accessible name; consumers that need such a slot announced (e.g. an "unassigned" avatar) can pass `aria-label` through the forwarded rest props, which lands on the root element. No behavior change.
  - **`DiffStatistics`** — clarified the `variant` prop description (`default` shows full statistic markup; `compact` trims it for tight surfaces) and distinguished it from the separate `density` prop, which adjusts control height.

- [#421](https://github.com/stevekinney/cinder/pull/421) [`7aa96e4`](https://github.com/stevekinney/cinder/commit/7aa96e4251589a24f31d0d118d7775950b5a6e06) Thanks [@stevekinney](https://github.com/stevekinney)! - Fix the component-example generator's metadata extraction so escaped delimiters
  and line continuations inside an example's `title`/`description` string literal
  no longer truncate the value or leak the `<script module>` block into the
  published `code` field ([#420](https://github.com/stevekinney/cinder/issues/420)). The extraction grammar is now escape-aware and
  the parsed value is decoded to its true string. No existing example artifact
  changes — this only affects future examples whose metadata contains an escape
  sequence.

- [#428](https://github.com/stevekinney/cinder/pull/428) [`5d0a325`](https://github.com/stevekinney/cinder/commit/5d0a32506b97b51b5955917dda7c2898dceb5d74) Thanks [@stevekinney](https://github.com/stevekinney)! - Tame the overlay entrance/exit motion. The shared `--cinder-ease-spring` timing function was a back-ease (`cubic-bezier(0.34, 1.56, 0.64, 1)`) whose `y1` control point of `1.56` overshot to 156% of the animated travel before settling. On `Sheet` and `Drawer` — where the panel translates a full 100% of its own width/height — that overshoot flung the panel well past the viewport edge mid-transition. `Modal` and `CommandPalette` (which share the token) showed the same pop on a smaller scale. The token is now a settled ease-out (`cubic-bezier(0.22, 1, 0.36, 1)`): the same snappy decelerate-in feel with no overshoot, so overlays slide cleanly to rest. No API change.

- [#412](https://github.com/stevekinney/cinder/pull/412) [`ed74f22`](https://github.com/stevekinney/cinder/commit/ed74f2228f933cda5f8219237765e738ffd848f6) Thanks [@stevekinney](https://github.com/stevekinney)! - Add descriptions for previously-undocumented public props so every prop now renders a Description in its generated README table and JSON schema ([#373](https://github.com/stevekinney/cinder/issues/373)). Documentation only — no runtime or type-shape changes.

- [#410](https://github.com/stevekinney/cinder/pull/410) [`52efdcf`](https://github.com/stevekinney/cinder/commit/52efdcfecb06e4a93c280c85dfeb5373e85b4ba6) Thanks [@stevekinney](https://github.com/stevekinney)! - Correct generated schema/documentation prop surfaces flagged in the component audit ([#393](https://github.com/stevekinney/cinder/issues/393)).
  - **`Textarea`** — `required` and `maxlength` now appear as first-class typed props (`boolean` / `number`) in the schema and README props table instead of being silently dropped as inherited HTML attributes. Both already drive component behavior (form validation wiring and the `showCount` character counter).
  - **`Timeline`** — the internal `role` escape-hatch is now typed `never` instead of `unknown`, matching the public contract (which omits `role` so consumers cannot clobber the `<ol>`'s implicit `list` role). No public API change.
  - **`TreeItem`** — replaced a leaked internal note ("see tree.svelte plan for rationale") on the `branch` prop with a consumer-facing description of branch semantics.

  Also regenerates schema artifacts that had drifted from their source types on `main`, surfacing two props that were already accepted but undocumented:
  - **`AvatarGroup`** — `label` (`string`, default `"Collaborators"`) now appears in the schema and README as the accessible name for the avatar stack.
  - **`Popover`** — `closeOnEscape` (`boolean`, default `true`) now appears in the schema and README; it controls whether Escape closes the Popover (set `false` when a parent composite widget owns Escape for the whole interaction).

- [#436](https://github.com/stevekinney/cinder/pull/436) [`4a68b09`](https://github.com/stevekinney/cinder/commit/4a68b09108bdf9b3501f730293631c286840d6ef) Thanks [@stevekinney](https://github.com/stevekinney)! - Fix two component CSS defects surfaced by the playground:
  - **Timeline connector** now spans each marker's center to the next marker's
    center instead of stopping `space-1` short, so the rail reads as one
    continuous line through the dots rather than disconnected stubs (notably with
    custom marker snippets). The connector's `bottom` offset now accounts for the
    marker's own `margin-top` inside the next event grid.
  - **Code block** no longer renders per-token background bands in dark mode. The
    generated `<code>` element (and Shiki line/token spans) are forced transparent
    so the single `<pre>` surface shows through as one uniform field; only token
    foreground colors apply. The header copy button also gains real button
    affordance — a 28px-square hit target (clearing WCAG 2.5.8) with a subtle
    resting chip background — instead of a bare floating glyph.

## 0.2.0

### Minor Changes

- API-ergonomics refinements across several components ([#328](https://github.com/stevekinney/cinder/issues/328), resolving [#307](https://github.com/stevekinney/cinder/issues/307), [#309](https://github.com/stevekinney/cinder/issues/309), [#315](https://github.com/stevekinney/cinder/issues/315)). All additive and backward-compatible.
  - **Card `padding="none"`** — removes body padding for full-bleed content, replacing the consumer workaround that reached into the internal `.cinder-card__body` class. Stamps `data-cinder-padding` on the body.
  - **`Dropdown.Item` polymorphism** — renders `<a href>` when `href` is present and lets `type="submit"` flow to the `<button>`. Shared event handlers are typed at the `HTMLElement` base so existing button consumers with inline handlers keep typechecking; `role="menuitem"`, roving `tabindex`, and close-on-select are preserved on both branches.
  - **Alert `variant="danger"`** — an additive alias for `error`.
  - **NavigationBar** type refinements, **Badge `mono`**, and additional **StatusDot** statuses.

- `Button` now forwards the popup-trigger ARIA attributes `aria-expanded`, `aria-controls`, and `aria-haspopup` ([#306](https://github.com/stevekinney/cinder/issues/306)), so a button that opens a menu, dialog, or disclosure can be wired up without reaching past the component's prop surface.

- Add the `ChoiceGrid` compound component ([#332](https://github.com/stevekinney/cinder/issues/332), resolving [#318](https://github.com/stevekinney/cinder/issues/318)).

  A responsive grid of large selectable choices with roving keyboard focus, single/multi-select, and correct/incorrect/pending feedback states — for quiz, assessment, and answer-selection surfaces. `ChoiceGrid` composes `ChoiceGrid.Item` via context. Single-select renders a `radiogroup` (arrow keys move selection, per WAI-ARIA); multi-select renders a `group` of checkboxes (arrows move focus only). Disabled items are skipped by both focusable-item computation and arrow navigation. Supports `columns="responsive"` (auto-fill) or a fixed 1–4.

- Add `DataTable`, `PricingCard`, and `SubscriptionBadge` components ([#340](https://github.com/stevekinney/cinder/issues/340), resolving [#334](https://github.com/stevekinney/cinder/issues/334)–[#336](https://github.com/stevekinney/cinder/issues/336)).
  - **DataTable** — a data-driven `<DataTable rows columns caption />` wrapper over the compositional Table family: sortable columns (reusing Table's bindable `sort` + `aria-sort`), a horizontal-scroll responsive container, and `<th scope="row">` row-header semantics via a new additive `as?: 'td' | 'th'` prop on `TableCell` (default `'td'`, so existing consumers are unchanged).
  - **PricingCard** — a plan tile with name, price, feature list, an optional consumer-supplied caveat line, and a selectable state shown with both accent treatment and a visible "Selected" text flag (WCAG 1.4.1). The CTA is a real cinder `Button`.
  - **SubscriptionBadge** — an opinionated `Badge` variant for the six billing states.

- Add `MatrixChart` and the signal-visualization chart components ([#333](https://github.com/stevekinney/cinder/issues/333), resolving [#319](https://github.com/stevekinney/cinder/issues/319) and [#324](https://github.com/stevekinney/cinder/issues/324)).
  - **MatrixChart** — a categorical × categorical heatmap (confusion matrices, correlation grids) with sequential and zero-centered diverging color scales, cell + axis labels, and an accessible data-table fallback. Sparse/missing and non-finite cells render predictably as "missing".
  - **Waveform** — time-domain amplitude as a path or bars, with min/max-envelope downsampling for large buffers.
  - **SpectrumChart** — frequency-bin magnitude bars with a zero-guarded real max.
  - **Spectrogram** — a time × frequency heatmap.

  All reuse the shared `_internal/chart` infrastructure (palette, formatting, accessible fallback) plus a new shared `_internal/chart/heatmap-utilities`.

- Add `MediaControls`, `CapabilityGate`, `ShareCard`, `KeyboardShortcuts`, and `ShortcutHint` components ([#339](https://github.com/stevekinney/cinder/issues/339), resolving [#320](https://github.com/stevekinney/cinder/issues/320)–[#323](https://github.com/stevekinney/cinder/issues/323)).
  - **MediaControls** — accessible play/pause/replay with optional progress; the play/pause control is a stable-label `aria-pressed` toggle, with distinct loading and unavailable states and both compact icon-only and expanded layouts.
  - **CapabilityGate** — presents a feature's availability (supported / unsupported / permission-needed / permission-denied / loading / unavailable) with primary, fallback, and dismiss actions, backed by a `role="status"` live region carrying `aria-busy`.
  - **ShareCard** — copy-link / copy-text / native `navigator.share` with a graceful copy fallback; user-cancel (`AbortError`) is silent.
  - **KeyboardShortcuts** and **ShortcutHint** — keyboard-shortcut discovery surfaces.

- Add the `SkipLink` (skip-to-content) component ([#329](https://github.com/stevekinney/cinder/issues/329), resolving [#308](https://github.com/stevekinney/cinder/issues/308)).

  A composed skip-to-content primitive that owns the non-obvious focus management internally: the tabindex save → focus → restore-on-blur dance, `prefers-reduced-motion` handling, and a native-anchor-jump fallback when the target id is absent. Composes over `VisuallyHidden` (`as="a"`, `focusable`). The prop surface is intentionally minimal (`target`, `children`, `class`).

- [#312](https://github.com/stevekinney/cinder/pull/312) [`dd69bba`](https://github.com/stevekinney/cinder/commit/dd69bba51e4784a0051b9fa5cfc9f9992dbe413c) Thanks [@stevekinney](https://github.com/stevekinney)! - Visual-token refinement that improves light/dark separation and accent legibility, plus six new semantic alias tokens.
  - **Accent reads more like ink.** `--cinder-accent` is now `light-dark(oklch(66% 0.16 195), oklch(78% 0.13 195))` — the light arm darkens from the previous bright cyan toward a more ink-like read (its foreground contrast improves from ~2:1 to ~2.7:1, though it still uses the dedicated `--cinder-accent-text` token for foreground use), and the dark-arm chroma calms from 0.15 to 0.13 to stop the cyan vibrating. As a fill it carries the dark-ink `--cinder-accent-contrast` label at ~7.2:1. Because `--cinder-accent-hover` and `--cinder-accent-active` derive from `--cinder-accent` with `oklch(from …)`, both hover and active states re-derive automatically. `--cinder-accent-text` keeps its dark-arm chroma in lockstep at 0.13.
  - **New `--cinder-accent-active-on-fill` token keeps pressed primary buttons AA-legible.** Darkening the base accent dropped the general `--cinder-accent-active` (a `−0.15` lightness step → `L=0.51`) to ~4.09:1 for the dark-ink label on a pressed primary `Button`/`FloatingActionButton`, below WCAG AA. The new token uses a gentler `−0.11` step (light `L=0.55` ~4.79:1, dark ~7.1:1); those two components now consume it for their pressed fill. `--cinder-accent-active` is unchanged for every other consumer.
  - **Wider dark surface ladder.** The dark elevation steps now run 15 → 20 → 26 → 11 (`--cinder-surface-raised` 24% → 26%, `--cinder-surface-inset` 12% → 11%); `--cinder-bg` and `--cinder-surface` are unchanged.
  - **Stronger borders in both arms.** `--cinder-border` becomes `light-dark(oklch(79% 0.013 245), oklch(40% 0.05 245))` for a more defined edge against surfaces.
  - **Deeper small elevation.** `--cinder-shadow-sm` gains a second hairline layer and higher alphas in both arms; `--cinder-shadow-md` and `--cinder-shadow-lg` raise their dark-arm alphas (light arms unchanged).
  - **Disabled text holds AA against the widened dark surfaces.** `--cinder-text-disabled` dark arm moves from 62% to 64% so disabled labels keep ≥4.5:1 on the lifted dark `--cinder-surface-raised` (a disabled RadioGroup legend would otherwise drop to ~3.6:1).
  - **Six new semantic alias tokens** (additive, public) that express intent over the raw scale: `--cinder-pad-control`, `--cinder-pad-card`, `--cinder-gap-stack`, `--cinder-gap-inline`, `--cinder-radius-control`, and `--cinder-radius-surface`.

### Patch Changes

- Fix the `AvatarGroup` trigger focus ring ([#331](https://github.com/stevekinney/cinder/issues/331)) — restore the ring by replacing an invalid offset token with `--cinder-ring-offset` plus a fallback.

- Add keyboard focus rings to chart marks. Area, bar, and line charts now render an SVG focus ring on keyboard focus (driven by the shared `_internal/chart/chart-focus-ring` helper) and respond to the pointer-vs-keyboard focus modality, so the ring shows for keyboard navigation without flashing on click.

- Promote the transparency-checkerboard colors to public theme-aware tokens ([#330](https://github.com/stevekinney/cinder/issues/330)). The color picker, color field, and swatch picker now repoint their alpha checkerboards to the shared tokens, and the color-picker thumb keeps its dark-contrast edge across themes with an added dark-mode support ring.

- Normalize domain/editor focus indicators ([#313](https://github.com/stevekinney/cinder/issues/313)). Chat, review-editor, diff-viewer, and markdown-editor surfaces now use the shared focus-ring recipe (`--_cinder-focus-ring-shadow`) instead of hand-rolled `box-shadow` rings, with documented inset variants where dense-surface geometry would otherwise clip the outer ring.

- Packaging fixes for consumers ([#327](https://github.com/stevekinney/cinder/issues/327), resolving [#311](https://github.com/stevekinney/cinder/issues/311) and [#314](https://github.com/stevekinney/cinder/issues/314)).
  - **`lucide-svelte` is now a peer dependency** (`>=0.400.0 <1`) instead of a regular dependency, so consumers use their own copy rather than a nested duplicate. It stays a devDependency so cinder's own build, tests, and playground still resolve the icons it imports.
  - **`types` condition on the CSS-only style subpaths** (`./styles`, `./styles/all`, `./styles/tokens`, `./styles/foundation`, `./styles/utilities`) — a side-effect `import '@lostgradient/cinder/styles'` now resolves types correctly under `moduleResolution: bundler` (the SvelteKit default).

## 0.1.1

### Patch Changes

- Harden the release pipeline (no library/runtime changes):
  - `verify-release-version.ts` now prefers `TAG_NAME` over `GITHUB_REF_NAME`, so a `workflow_dispatch` release no longer needs a tag-ref workaround to pass the version check.
  - Pin Bun to `1.3.13` in `release.yaml` and `release-manual.yaml` (was the stale `1.3.2`), aligning them with the rest of CI and fixing the `dequal` bundler "Multiple files share the same output path" collision.
  - Disable npm provenance consistently in both `NPM_CONFIG_PROVENANCE` and `publishConfig.provenance`, since `npm publish` runs under Bun's BoringSSL which fails provenance signing (`ERR_OSSL_NO_DEFAULT_DIGEST`).

## 0.1.0

### Major Changes

- [#260](https://github.com/stevekinney/cinder/pull/260) [`f47aac5`](https://github.com/stevekinney/cinder/commit/f47aac589f31eb98fcdadaf36a00d83a756f2fd3) Thanks [@stevekinney](https://github.com/stevekinney)! - Chat: vendor the conversation data model and drop the `conversationalist` dependency.

  Chat now defines its own conversation/message/tool types (`cinder/chat` exports `ConversationHistory`, `Message`, `ToolCall`, `ToolResult`, `ToolCallPair`, etc.) and ships small builders (`createConversation`, `appendUserMessage`, `appendAssistantMessage`, `appendMessages`). The vendored types are a faithful structural mirror of `conversationalist`'s shapes, so a `conversationalist` `Message` or an `armorer` tool call/result satisfies them with no adaptation.

  **Breaking:** `ChatProps.conversation` is now `ConversationHistory` (a plain transcript snapshot) instead of `conversationalist`'s `Conversation`. If you use `conversationalist`, its `Conversation` class exposes the snapshot via its `.current` getter (`<Chat conversation={conversation.current} />`) — the shapes are structurally compatible, so no mapping is needed.

  Also in this change:
  - The tool-call message role is now `'tool-call'` (was `'tool-use'`).
  - Tool-result errors render the structured `error.message` instead of `[object Object]`, and `action_required` outcomes now render a distinct state with the requested action's message.
  - The public `Chat` component now forwards the imperative streaming + scroll API — `beginStreaming(messageId)`, `pushToken(token)`, `endStreaming()`, `scrollToBottom()`, `scrollToTop()`, `focusInput()` — so consumers can drive token-by-token streaming through a `bind:this` to `<Chat>` (additive; previously these lived only on the unexported inner implementation).

- [#209](https://github.com/stevekinney/cinder/pull/209) [`f9e424c`](https://github.com/stevekinney/cinder/commit/f9e424c45e254f72ccf29c9da88b27e642919564) Thanks [@stevekinney](https://github.com/stevekinney)! - **Breaking: `<CinderProvider>` is removed; `<CodeBlock>` highlights automatically.**

  `<CinderProvider>` and `CinderProviderProps`, plus the `cinder/cinder-provider`,
  `cinder/cinder-provider/schema`, and `cinder/cinder-provider/variables` subpath
  exports, are gone. `<CodeBlock>` now highlights itself: set a `language` and it
  lazy-loads the bundled `cinder/highlighters/shiki` adapter on the client and
  highlights with no provider and no wiring. Highlighting is a two-phase,
  client-only enhancement — the server emits the plain `<pre><code>` fallback and
  the client swaps in highlighted HTML once Shiki resolves.

  Trade-off: the provider's one capability — scoping a single custom (non-Shiki)
  highlighter to a whole subtree — is gone. The common case (Shiki, default
  theme) now requires zero configuration; a custom highlighter is passed
  per-instance via the new `highlighter` prop instead.

  **Migration:**

  ```svelte
  <!-- before -->
  <script lang="ts">
    import { CinderProvider, CodeBlock } from 'cinder';
    import { shikiHighlighter } from 'cinder/highlighters/shiki';

    const highlighter = shikiHighlighter();
  </script>

  <CinderProvider {highlighter}>
    <CodeBlock {code} language="ts" />
  </CinderProvider>
  ```

  ```svelte
  <!-- after: the common case needs nothing — CodeBlock auto-loads Shiki -->
  <script lang="ts">
    import { CodeBlock } from 'cinder';
  </script>

  <CodeBlock {code} language="ts" />
  ```

  ```svelte
  <!-- after: a custom highlighter is now per-instance via the `highlighter` prop -->
  <script lang="ts">
    import { CodeBlock } from 'cinder';
    import { shikiHighlighter } from 'cinder/highlighters/shiki';

    const highlighter = shikiHighlighter({ theme: 'github-light' });
  </script>

  <CodeBlock {code} language="ts" {highlighter} />
  ```

  New `<CodeBlock>` props:
  - `highlighter?: Highlighter` — a custom highlighter for this instance, used in
    place of the bundled default. Its output is rendered **verbatim via `{@html}`**
    and must escape any user-provided `code` (cinder only guarantees the bundled
    Shiki default's output is escaped).
  - `highlight?: boolean` — defaults to `true` whenever `language` is set.
    `highlight={false}` is an absolute off switch: it disables all highlighting
    (including an explicit `highlighter`), triggers no Shiki import, and renders
    the escaped plain `<pre><code>` fallback while keeping the `language` label.

  **Rollback:** this ships as a single atomic commit (deletion, CodeBlock change,
  docs, and generated artifacts), so reverting that one commit restores the
  previous state in full.

- [#272](https://github.com/stevekinney/cinder/pull/272) [`ace7c34`](https://github.com/stevekinney/cinder/commit/ace7c34978cfec705bf7206507213f2f58c8365c) Thanks [@stevekinney](https://github.com/stevekinney)! - Breaking: `Message` replaces the single `time` prop with `datetime` and `timestamp`.

  The old `time` prop was placed on both the machine-readable `<time datetime>`
  attribute and the visible text, so a human label like `"9:41 AM"` produced an
  invalid `datetime` value. Now:
  - `datetime` — the machine-readable value for the `<time datetime>` attribute
    (e.g. `"2026-04-29T09:41"`).
  - `timestamp` — the human-readable display text. Falls back to `datetime` when
    omitted.

  Migration: replace `time="9:41 AM"` with
  `datetime="2026-04-29T09:41" timestamp="9:41 AM"`. If you were already passing a
  valid ISO value, `datetime="…"` alone is sufficient.

  Also: `Message` now forwards native HTML attributes (`id`, `data-*`, `aria-*`,
  etc.) to its root `<article>`. Component-controlled attributes (`data-cinder-role`,
  `class`) cannot be clobbered.

- [#170](https://github.com/stevekinney/cinder/pull/170) [`5238aab`](https://github.com/stevekinney/cinder/commit/5238aabe5273b6235b679ef6488e4570b971546b) Thanks [@stevekinney](https://github.com/stevekinney)! - Breaking: StatusDot status `"building"` renamed to `"pending"`. Update `status="building"` → `status="pending"`. The dot color is unchanged (still info-blue) — only the status token name changed.

### Minor Changes

- [#276](https://github.com/stevekinney/cinder/pull/276) [`ba665e0`](https://github.com/stevekinney/cinder/commit/ba665e0f122bae181da46c5fced39fa6090a3f72) Thanks [@stevekinney](https://github.com/stevekinney)! - Add `ClickAwayListener` — a headless utility that calls `onClickAway` when the user
  presses a pointer (mouse or touch) outside its subtree.
  - Listens on `pointerdown` (covers mouse + touch), falling back to `mousedown` +
    `touchstart` on browsers without the Pointer Events API.
  - `enabled` (default `true`) detaches the listener without unmounting.
  - Headless — renders only a wrapper element around its `children`, no styling.

  Use it for custom inline-edit fields, custom dropdowns, or any overlay that should
  dismiss on outside interaction. Popover, Dropdown, and Modal already handle this
  internally.

- [#275](https://github.com/stevekinney/cinder/pull/275) [`f62b5a4`](https://github.com/stevekinney/cinder/commit/f62b5a483c88f7de6c60ce581f9dca49d16923f1) Thanks [@stevekinney](https://github.com/stevekinney)! - Add `FloatingActionButton` (FAB) — a circular button for the single most important
  action on a screen.
  - `variant`: `'filled'` (circular) | `'extended'` (pill with icon + label).
  - `size`: `'sm'` | `'md'` | `'lg'`; `color`: `'primary'` | `'secondary'` | `'surface'`.
  - Renders a `<button type="button">`, or an `<a>` when `href` is passed. A disabled
    link withholds its `href` and is removed from the tab order so it can't navigate.
  - Requires an accessible name (`aria-label`/`aria-labelledby`, or `children`); emits a
    dev-mode warning when one is missing.
  - Does not manage positioning — wrap it in your own fixed/sticky container.

- [#274](https://github.com/stevekinney/cinder/pull/274) [`899b7ee`](https://github.com/stevekinney/cinder/commit/899b7eefadc252276fd12e9dbc6b32c9247d43e4) Thanks [@stevekinney](https://github.com/stevekinney)! - Add Link — inline text link (typography) with configurable underline behavior and color, external link safety, and disabled state.

- [#273](https://github.com/stevekinney/cinder/pull/273) [`b888707`](https://github.com/stevekinney/cinder/commit/b888707bf6c0c2fa41b14d554a7093cb998d24d9) Thanks [@stevekinney](https://github.com/stevekinney)! - Add `Typography` — a text component that renders a named typographic variant
  (`h1`–`h6`, `subtitle1/2`, `body1/2`, `caption`, `overline`, `label`) mapped to
  the cinder design-token scale, on a semantically appropriate but overridable
  HTML element.
  - `variant` drives the type style; the element defaults to the semantically
    correct tag (`h1`→`<h1>`, `body1`→`<p>`, `caption`→`<span>`, subtitles→`<p>`).
  - `component` overrides the rendered element while keeping the variant's style
    (e.g. `variant="h1" component="span"` for SEO/structure control).
  - `gutterBottom` adds bottom margin; `noWrap` truncates to a single line with an
    ellipsis.
  - Forwards native HTML attributes to the rendered element.

- [#173](https://github.com/stevekinney/cinder/pull/173) [`b460e92`](https://github.com/stevekinney/cinder/commit/b460e92a4b96e1da565ca8017c1d6cecd82a8321) Thanks [@stevekinney](https://github.com/stevekinney)! - Polish Data Display and Surfaces visual contracts across table, feed, description-list, grid-list, diff-statistics, card, avatar, diff-viewer, and supporting examples.

  `PageLayout` now renders breadcrumbs inside `.cinder-page-layout-header`; update direct-child selectors from `.cinder-page-layout > .cinder-page-layout-breadcrumbs` to `.cinder-page-layout-header .cinder-page-layout-breadcrumbs`.

  `Surface tone="transparent"` no longer shows a visible border.

- [#111](https://github.com/stevekinney/cinder/pull/111) [`5ae5627`](https://github.com/stevekinney/cinder/commit/5ae562725e254c3de6e545a1cc84ca851e22c0d0) Thanks [@stevekinney](https://github.com/stevekinney)! - New first-party Shiki adapter at `cinder/highlighters/shiki`. `<CodeBlock>` already auto-loads it with default options when a `language` is set, so you only need it directly to customize the theme or preload grammars — then pass it via the `highlighter` prop. No manual `codeToHtml` wrapper required.

  ```svelte
  <script lang="ts">
    import { CodeBlock } from 'cinder';
    import { shikiHighlighter } from 'cinder/highlighters/shiki';

    const highlighter = shikiHighlighter({ theme: 'github-light' });
  </script>

  <CodeBlock {code} language="ts" {highlighter} />
  ```

  **Options:**
  - `theme?: string | { light: string; dark: string }` — single theme string, or the dual-theme object form that emits CSS variables for `light-dark()`-driven theming. Defaults to `{ light: 'github-light', dark: 'github-dark' }`.
  - `langs?: readonly string[]` — languages to preload at first highlight (otherwise Shiki resolves on demand).

  **Fallback contract:** empty, missing, or unknown languages render as escaped plaintext wrapped in `<pre><code>` (no throw, warns once per language). Internal Shiki errors are caught and produce the same fallback. The plaintext path HTML-escapes its input so `{@html}` injection stays safe.

  **Bundle impact:** Shiki is dynamic-imported on the first highlight call inside the factory's returned function. Consumers who never import `cinder/highlighters/shiki` ship zero Shiki bytes in their entry chunk; consumers who do ship a lazy chunk that loads when the first `<CodeBlock>` highlights.

- [#206](https://github.com/stevekinney/cinder/pull/206) [`31cce14`](https://github.com/stevekinney/cinder/commit/31cce1483b033bab644b6eda22008a06d6b16fc8) Thanks [@stevekinney](https://github.com/stevekinney)! - Promote a batch of beta and experimental components to stable.

  **Beta → stable (12 components):** collapsible, container, autocomplete, command-menu, load-more, selection-popover, menu-bar, resizable-panels, kanban-board, area-chart, bar-chart, line-chart. Each passed the stable-promotion gate (`bun run components:promotion-check`).

  **Experimental → stable, with new import paths (5 components):** connection-indicator, json-viewer, message, timeline, timeline-item moved out of `src/components/experimental/` into the main tree. They are now imported from `cinder/<name>` (for example `cinder/timeline`) instead of `cinder/experimental/<name>`.

  The old `cinder/experimental/<name>` import paths still resolve as **deprecated aliases** that re-export the promoted component. Importing an alias logs a one-time deprecation warning in development pointing at the new path. The alias paths — `cinder/experimental/<name>` plus their `/schema`, `/variables`, `/styles`, and `/examples` subpaths — will be removed in the next major version. Migrate to `cinder/<name>` at your convenience.

  No runtime behavior changed for any promoted component; this is a status and import-path change.

### Patch Changes

- [#171](https://github.com/stevekinney/cinder/pull/171) [`7559330`](https://github.com/stevekinney/cinder/commit/755933055284981d4789485dd42aa44af5279735) Thanks [@stevekinney](https://github.com/stevekinney)! - Buttons & Actions visual polish.
  - New `--cinder-text-md` design token (15px) and a clearer button font-size ladder: `lg` now uses `--cinder-text-md` (15px) and `xl` uses `--cinder-text-lg` (16px), so large buttons read as visibly larger than the default. `xs`/`sm`/`md` are unchanged.
  - Ghost buttons keep their muted text color on hover and only change background, so hover no longer brightens the label.
  - Button groups draw a single deterministic 1px seam between members via a pseudo-element instead of overlapping borders with negative margins, so mixed-variant groups no longer hairline-notch at transparent-bordered boundaries.
  - Dropdown danger items now show a danger-colored focus ring (`--cinder-danger`) instead of the neutral ring.
  - Segmented-control selected and pressed segments now respond to hover (the accent fill darkens) so they no longer read as disabled.

- [#225](https://github.com/stevekinney/cinder/pull/225) [`ec216d4`](https://github.com/stevekinney/cinder/commit/ec216d48fd7e23530ebed36e1452c9ac36c61de4) Thanks [@stevekinney](https://github.com/stevekinney)! - Use the staged publish artifact for consumer validation, release dry-runs, and npm publishing; broaden the Svelte peer contract to tested Svelte 5 versions; and add package-weight reporting with release budgets.
