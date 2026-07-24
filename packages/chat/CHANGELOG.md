# @lostgradient/chat

## 0.2.0

### Minor Changes

- [#843](https://github.com/stevekinney/cinder/pull/843) [`e95a26e`](https://github.com/stevekinney/cinder/commit/e95a26e407d342ecce8392ac8c7f3b6bab8b6049) Thanks [@stevekinney](https://github.com/stevekinney)! - Add a validated `cinder:artifact` message metadata convention and expose resolved artifacts to per-row Chat snippets, including artifacts attached to folded tool-result messages.

- [#833](https://github.com/stevekinney/cinder/pull/833) [`30feaa5`](https://github.com/stevekinney/cinder/commit/30feaa509548f436e77c47520d9b49193f76c6f4) Thanks [@stevekinney](https://github.com/stevekinney)! - Require `@lostgradient/cinder@^0.17.0` and correct the install instructions.

  `lucide-svelte` is no longer a peer dependency host applications install themselves — Cinder owns it
  as a pinned regular dependency. The peer range previously accepted every `0.16.x` release,
  where Lucide is still a peer, so a project updating only Chat could read the corrected README while
  still resolving its own Lucide version against Cinder's prebuilt SSR bundle and hitting a
  `hydration_mismatch` on first load. Requiring the fixed release closes that gap.

- [#808](https://github.com/stevekinney/cinder/pull/808) [`34052a6`](https://github.com/stevekinney/cinder/commit/34052a60cafce306772cee4adb2b3e1056c3a11c) Thanks [@stevekinney](https://github.com/stevekinney)! - `@lostgradient/chat` now owns its `conversationalist` and `zod` dependencies instead of declaring them as `peerDependencies`. Host applications no longer need to `bun add conversationalist zod` (or pick a compatible version) themselves — both install automatically alongside `@lostgradient/chat`. `@lostgradient/cinder` and `svelte` remain peer dependencies, since your application must control which single copy of those renders.

  `@lostgradient/chat` also re-exports `isJSONValue` from `conversationalist`, so consumers validating message content, metadata, or tool-call arguments before constructing a conversation no longer need to import `conversationalist` directly for it.

  **Consumer impact:** if your app currently lists `conversationalist` and/or `zod` as direct dependencies solely to satisfy `@lostgradient/chat`'s former peer requirement, you can remove them — `@lostgradient/chat` now supplies its own compatible version. If your app also uses `conversationalist` directly for something beyond what `@lostgradient/chat` re-exports (e.g. its adapters or schemas), keep your own dependency; npm/bun will de-duplicate compatible versions in the tree.

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

- [#837](https://github.com/stevekinney/cinder/pull/837) [`8f7fce3`](https://github.com/stevekinney/cinder/commit/8f7fce3e29c92c4a96104bebd39306cda08048c6) Thanks [@stevekinney](https://github.com/stevekinney)! - Pass a shared `ChatRowContext` to the `row`, `messageActions`, and `messageStatus` snippets. Paired tool results are folded into the visible tool-call row's context, so consumers can inspect the resolved `ToolCallPair` without rendering a duplicate result row or maintaining an external message lookup.

### Patch Changes

- [#828](https://github.com/stevekinney/cinder/pull/828) [`4c313fe`](https://github.com/stevekinney/cinder/commit/4c313feb67d61c4e255625f46ad09e85407f08ba) Thanks [@stevekinney](https://github.com/stevekinney)! - Keep below-bubble message actions visible while the pointer crosses from developer, system, snapshot, and tool message cards into their footers. Keyboard focus continues to reveal the same actions.

- [#842](https://github.com/stevekinney/cinder/pull/842) [`d0146f0`](https://github.com/stevekinney/cinder/commit/d0146f00e550ddfc4f570bf42dceb3b809d54dbb) Thanks [@stevekinney](https://github.com/stevekinney)! - Add a typed `mermaidRenderer` snippet to `ArtifactViewer` so applications can render Mermaid source with their chosen integration while retaining an explicit source fallback when no renderer is provided.

- [#838](https://github.com/stevekinney/cinder/pull/838) [`874a5ce`](https://github.com/stevekinney/cinder/commit/874a5ce26a607443b582bf9ebfdccaf34c3e9e45) Thanks [@stevekinney](https://github.com/stevekinney)! - Add `Chat.insertAtRange()` for applying composer popover selections without synthetic input events.

- [#818](https://github.com/stevekinney/cinder/pull/818) [`d958e8c`](https://github.com/stevekinney/cinder/commit/d958e8cbf60130b922483905baa317a0f4ec0359) Thanks [@stevekinney](https://github.com/stevekinney)! - Fixed `Chat`'s public wrapper so `bind:atBottom`, `bind:unreadCount`, and `bind:newMessageIndicatorVisible` no longer fail `svelte-check` with "Cannot use 'bind:' with this property. It is declared as non-bindable inside the component." The wrapper previously spread these props through `...rest` instead of declaring them with `$bindable()` and forwarding them to the internal implementation, so the package's emitted type declaration reported them as non-bindable even though `ChatProps` documented them as bindable. All three props now work correctly with `bind:`.

- [#830](https://github.com/stevekinney/cinder/pull/830) [`126ef9d`](https://github.com/stevekinney/cinder/commit/126ef9da09ae0dc7172136a8d3eff7a5e541b65d) Thanks [@stevekinney](https://github.com/stevekinney)! - Prevent the packed Chat wrapper's bindable scroll state from forcing a second server render that breaks lifecycle registration and SSR hydration.

- [#827](https://github.com/stevekinney/cinder/pull/827) [`9f8530c`](https://github.com/stevekinney/cinder/commit/9f8530cd6f03aa2c26b0bd57d0133d85ef653e3a) Thanks [@stevekinney](https://github.com/stevekinney)! - Export `pairToolCallsWithResults` and the `StepInfo` type from the package root so consumers can pair transcript tool calls and type message-step metadata without importing internal modules.

- [#831](https://github.com/stevekinney/cinder/pull/831) [`0a93b03`](https://github.com/stevekinney/cinder/commit/0a93b0371d537a5391c0c6ffe8465fb6fbd4e44c) Thanks [@stevekinney](https://github.com/stevekinney)! - Make `getMessageRoleLabel` and `ChatMessage` use the same user-facing role labels, including `You` for user messages.

- [#826](https://github.com/stevekinney/cinder/pull/826) [`0cee226`](https://github.com/stevekinney/cinder/commit/0cee22609b0b2f68c2f1a42a54b21b121f9dcc6b) Thanks [@stevekinney](https://github.com/stevekinney)! - Correct the `SuggestionMessagePart` documentation to explain that selecting a suggestion invokes the callback and refocuses the composer without automatically removing the chips, and document returning `[]` from `messageSuggestions` to suppress them.

- [#787](https://github.com/stevekinney/cinder/pull/787) [`6961eb8`](https://github.com/stevekinney/cinder/commit/6961eb8cc36412f299b73451be4535586a8c5bd5) Thanks [@stevekinney](https://github.com/stevekinney)! - Fix `scrollToTop()` (and the `Home` key jump-to-start shortcut) fighting the auto-stick-to-bottom effect in virtualized mode, where the viewport would oscillate and never reach the top. Both now suppress the auto-stick effect for the duration of the scroll, mirroring `jumpToLatest()`.

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

- [#825](https://github.com/stevekinney/cinder/pull/825) [`0dc8e95`](https://github.com/stevekinney/cinder/commit/0dc8e958473502a8e591db5789b85fa814f1fffe) Thanks [@stevekinney](https://github.com/stevekinney)! - Clarify that defined `typingParticipants` and `readReceipts` props determine visible state, including empty arrays and maps, while adapter events and derived state continue behind them. Both props now explicitly accept `undefined` so consumers using `exactOptionalPropertyTypes` can return visible state to the adapter path.

- [#810](https://github.com/stevekinney/cinder/pull/810) [`44e406b`](https://github.com/stevekinney/cinder/commit/44e406b7da61a9bcbb7e31c45bf96f379182c669) Thanks [@stevekinney](https://github.com/stevekinney)! - Document that `ChatAdapter.subscribe` runs inside Chat's own internal mount `$effect`, so a synchronous `$state` write inside `subscribe` (or inside a handler it invokes synchronously before returning) can throw `effect_update_depth_exceeded`. The JSDoc on `ChatAdapter.subscribe` and `ChatPushHandlers` now names the working pattern — defer the write with `queueMicrotask`/`tick()` — with an example, and the README calls out the same constraint. Added a regression test that pins the documented workaround.

- Updated dependencies [[`ffbbb2f`](https://github.com/stevekinney/cinder/commit/ffbbb2f3b6fc9ac8bbb14c598716e49cff72c517), [`fdecd5e`](https://github.com/stevekinney/cinder/commit/fdecd5e63a0ea2e3ca8e3d997efa3f815d1bd664), [`955adb0`](https://github.com/stevekinney/cinder/commit/955adb0459272b9d08ed8a5eb13b579ce83997a7), [`30feaa5`](https://github.com/stevekinney/cinder/commit/30feaa509548f436e77c47520d9b49193f76c6f4), [`f86e857`](https://github.com/stevekinney/cinder/commit/f86e8577f03cedad95858f5fb60a20f3265a2407), [`204928e`](https://github.com/stevekinney/cinder/commit/204928e8b07e6e1e7ea7f16c994ae3e201933bf9), [`62a9a75`](https://github.com/stevekinney/cinder/commit/62a9a75c321303f7f4c8cd8d429fc0d1a071f667), [`0ef0a27`](https://github.com/stevekinney/cinder/commit/0ef0a272568e716e0dac034e60347f5cf3f611d6), [`caa5b36`](https://github.com/stevekinney/cinder/commit/caa5b36ea46511a8e62f514d89e2f4a5726f9fc9), [`23a5ebc`](https://github.com/stevekinney/cinder/commit/23a5ebc161be56d1198829fb269372e67f85d5bb), [`35732d8`](https://github.com/stevekinney/cinder/commit/35732d8d15240082ccb5d7b4be6d6216a05c40ea), [`d7ecfc4`](https://github.com/stevekinney/cinder/commit/d7ecfc4cece464edddef9e027ae5176d40313766), [`fffa0ab`](https://github.com/stevekinney/cinder/commit/fffa0abf2ee41c9cf0a0e100eb5ee99447f5d5f4), [`e9c1146`](https://github.com/stevekinney/cinder/commit/e9c11464ca1ef5af0801439270f4e0e09411ad41), [`006641e`](https://github.com/stevekinney/cinder/commit/006641ebfd998a78e0c2d0459b503c750f9a014c), [`1b80249`](https://github.com/stevekinney/cinder/commit/1b802498e71f799ceac44becd67fec73f8b7d74c), [`4376c18`](https://github.com/stevekinney/cinder/commit/4376c18e2f0dd055ec629cd02035447f8f6e13b2), [`2174be0`](https://github.com/stevekinney/cinder/commit/2174be0182d834d8aa3f1dbe82a2b3fe54b153db), [`280ba3e`](https://github.com/stevekinney/cinder/commit/280ba3e9eed6e76d7534bd0f4f78ff8890cf05df), [`7e9d2f6`](https://github.com/stevekinney/cinder/commit/7e9d2f65b1b464762f6858a0e6429c1c6c52d4d1), [`356c5d7`](https://github.com/stevekinney/cinder/commit/356c5d7f7a4d3a7e9306b71e6039ce05382c7aa7), [`282b380`](https://github.com/stevekinney/cinder/commit/282b38060b765340a58f07487c53a0f9710d4033), [`31fd201`](https://github.com/stevekinney/cinder/commit/31fd20103079bc6cebeadab8c0e11390119754f3), [`88d8b17`](https://github.com/stevekinney/cinder/commit/88d8b17d99e74742d0819094b3c6a5740079d6c3), [`09bdd26`](https://github.com/stevekinney/cinder/commit/09bdd2627ef2a36edf502add662ffd08a9b6ae41)]:
  - @lostgradient/cinder@0.17.0
  - @lostgradient/markdown@0.1.0

## 0.1.1

### Patch Changes

- [#767](https://github.com/stevekinney/cinder/pull/767) [`914eb83`](https://github.com/stevekinney/cinder/commit/914eb83b9d55355117de7ed57c1abfb7fdfc4dd1) Thanks [@stevekinney](https://github.com/stevekinney)! - Verify packed browser-condition exports resolve to published dist files.

- [#765](https://github.com/stevekinney/cinder/pull/765) [`772d280`](https://github.com/stevekinney/cinder/commit/772d280ea86b7cbeb82cdc47184f1c11cfe95875) Thanks [@stevekinney](https://github.com/stevekinney)! - Widen the supported `conversationalist` peer range to include `0.4.x` and verify the packed consumer surface against the current package.

- Updated dependencies [[`01cfe20`](https://github.com/stevekinney/cinder/commit/01cfe20711569effdd5643c3b985603a1536f7df)]:
  - @lostgradient/cinder@0.16.1

## 0.1.0

### Minor Changes

- [#760](https://github.com/stevekinney/cinder/pull/760) [`a373800`](https://github.com/stevekinney/cinder/commit/a373800445a0b11e4b6d84b94d5167999b071879) Thanks [@stevekinney](https://github.com/stevekinney)! - Extract the Chat component into the peer-dependency-only `@lostgradient/chat` package and remove it from Cinder's core package exports.

### Patch Changes

- Updated dependencies [[`a373800`](https://github.com/stevekinney/cinder/commit/a373800445a0b11e4b6d84b94d5167999b071879)]:
  - @lostgradient/cinder@0.16.0
