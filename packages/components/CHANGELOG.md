# @lostgradient/cinder

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
