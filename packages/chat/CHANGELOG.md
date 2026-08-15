# @lostgradient/chat

## 0.9.4

### Patch Changes

- [#1314](https://github.com/stevekinney/cinder/pull/1314) [`c78cb9f`](https://github.com/stevekinney/cinder/commit/c78cb9fda2776e92542f623d10efde33238eb2fc) Thanks [@stevekinney](https://github.com/stevekinney)! - Document, in this package's README, that `Chat`'s `row`/`messagePart` overrides are inversion-of-control (each receives a `renderDefault` snippet and wraps the built-in rendering) — the counterpart half of the judgement call recorded in [#1311](https://github.com/stevekinney/cinder/pull/1311), which added the matching note to `@lostgradient/editor`'s README about `DiffViewer`'s `toolbar` prop being total replacement with no `renderDefault`, deliberately unlike `Chat`'s.

  [#1311](https://github.com/stevekinney/cinder/issues/1311) shipped the README section itself in this package but only added a changeset for `@lostgradient/editor`, so the "Overriding built-in rendering" section landed on `main` without ever going out in a `@lostgradient/chat` release. This changeset is the missing release trigger for content that's already merged — no code or README change here, patch because it's docs-only.

## 0.9.3

### Patch Changes

- [#1296](https://github.com/stevekinney/cinder/pull/1296) [`885f92a`](https://github.com/stevekinney/cinder/commit/885f92a672145d08f9ea4ba5c7e2fadfc9e85769) Thanks [@stevekinney](https://github.com/stevekinney)! - Return focus when the artifact panel closes, instead of dropping it on `<body>`.

  `ArtifactPanel` focuses its Close button on mount so a keyboard user lands inside the panel — deliberate and good — but nothing restored focus on unmount. Closing therefore left `document.activeElement` as `<body>`: the next Tab restarts at the top of the document, and a screen reader announces nothing. Reproduced identically in Chromium, Firefox, and WebKit, so this was never an engine quirk.

  The attachment now captures the previously focused element before taking focus and restores it on teardown, guarded on `isConnected` — restoring to a detached node is a silent no-op that would leave the bug in place with no signal. Stated plainly because it is a real limit: a consumer whose close also removes the control that opened the panel still has to manage focus itself, since by teardown the panel has no surviving element of its own to offer either.

  Fixes [#1299](https://github.com/stevekinney/cinder/issues/1299).

## 0.9.2

### Patch Changes

- [#1285](https://github.com/stevekinney/cinder/pull/1285) [`bfcd9ed`](https://github.com/stevekinney/cinder/commit/bfcd9ed490ebfb19ed9c1f14c9c7032bef5efdee) Thanks [@stevekinney](https://github.com/stevekinney)! - Keep keyboard shortcuts alive after jumping to the latest message in a
  virtualized transcript.

  Jump-to-latest focused a message row one tick after scrolling. In a virtualized
  transcript that row is a recycled window slot: the virtualizer's next pass
  unmounts it, and removing the focused node drops focus to `<body>`. Because the
  keydown handler is bound on the container, that killed every shortcut — End,
  Home, PageUp/PageDown, arrow navigation, and Ctrl+F search — on the configuration
  recommended for long histories.

  The selector was independently wrong: `.chat-message-wrapper:last-of-type` matched
  every wrapper, since each is the only child of its virtual row, so it focused the
  row at the TOP of the window rather than the last message.

  Focus now goes to the `.chat-timeline` viewport, which is focusable, sits above
  the recycled rows, and never unmounts while the chat is alive. A backstop
  re-checks the focused row's connectivity on each scroll-state recompute and
  pulls focus back to the timeline if the row was unmounted from under it —
  checked on scroll rather than on `focusout`, because a browser removing the
  focused node moves focus to `<body>` without reliably dispatching a focus event
  from the detached element.

  Home had the same defect, but only when virtualized: there the viewport is the
  stable target for the same reason. In a plain transcript the rows do not recycle,
  so Home still focuses the first message, which scrolls it into view and gives
  arrow navigation a starting point.

  ArrowUp/ArrowDown now also enter message navigation from the focused viewport,
  not only from an already-focused message. Without that, the virtualized Home
  above would have been a dead end — it focuses the viewport, and the next arrow
  key would have done nothing, leaving no keyboard route into the transcript.
  ArrowDown enters at the first rendered message and ArrowUp at the last; arrows
  pressed inside a control within a message (approval buttons, suggestion chips)
  still belong to that control.

## 0.9.1

### Patch Changes

- [#1260](https://github.com/stevekinney/cinder/pull/1260) [`39794b6`](https://github.com/stevekinney/cinder/commit/39794b62a7d7e04d0664434b5f1946481170026a) Thanks [@stevekinney](https://github.com/stevekinney)! - Keep non-virtualized history prepends anchored before Chromium presents the updated transcript.

- [#1261](https://github.com/stevekinney/cinder/pull/1261) [`c89a8b8`](https://github.com/stevekinney/cinder/commit/c89a8b88b62349baadeaf205546dcc3cca139613) Thanks [@stevekinney](https://github.com/stevekinney)! - Prefer Svelte source exports during SvelteKit server-side rendering so Chat and Cinder compile one matching hydration tree on the server and in the browser.

- Updated dependencies [[`c89a8b8`](https://github.com/stevekinney/cinder/commit/c89a8b88b62349baadeaf205546dcc3cca139613)]:
  - @lostgradient/cinder@0.24.1

## 0.9.0

### Minor Changes

- Widen internal peer ranges to follow the coordinated release.

### Patch Changes

- Updated dependencies [[`d13d4cd`](https://github.com/stevekinney/cinder/commit/d13d4cd39bea7b3024793ea8996021b2c8eafc68), [`b0583e2`](https://github.com/stevekinney/cinder/commit/b0583e2e0a44a3757000167ac4cc4171f5a7473b)]:
  - @lostgradient/cinder@0.24.0

## 0.8.1

### Patch Changes

- [#1252](https://github.com/stevekinney/cinder/pull/1252) [`c56b909`](https://github.com/stevekinney/cinder/commit/c56b909be83bcbcceae76bbd67ac4e2f5a54407a) Thanks [@stevekinney](https://github.com/stevekinney)! - Finish the reopened [#1237](https://github.com/stevekinney/cinder/issues/1237) work: non-virtualized history-prepend anchor restoration is now flash-free, exact, and immune to the stick-to-bottom race.

  Real-browser measurement of the 0.7.1 behavior showed three residual defects after the original fix:
  - **A visible flash on every prepend.** The restore ran a `tick` + `requestAnimationFrame` after the transcript effect, so the browser painted at least one frame of the un-compensated transcript (the prepended block pushing the anchored content down) before the correction landed — 40–130ms even on an unloaded machine, longer under CI-style load. The non-virtualized restore now runs in a plain `$effect`, synchronously in the same flush that commits the prepend, so the correction is applied before that frame ever paints. (The virtualized path keeps its frame-deferred flow: it pins the anchor row's virtual item in the interim and needs the measurement frame.)
  - **A deterministic drift equal to the load-trigger row's height change.** `isLoadingHistory` / `adapterHasMoreHistory` flip only after restoration settles, so the trigger swapping back from its loading state — or unmounting entirely on `hasMore: false` (measured: a 64px shift) — changed the height of the content above the anchor after every stabilization pass had already run, and nothing corrected it except by timing luck. A dedicated post-settle correction now re-measures the anchor after those flips commit and absorbs exactly that delta, skipping itself if the user scrolled in the window.
  - **A nondeterministic bottom-snap.** The auto-stick effect's message-count tracker was `$state` read and written inside the effect, so the effect self-invalidated and re-ran after a prepend; the rerun saw "no growth", lost the prepend signal, and — now that the synchronous restore had already cleared `pendingHistoryScroll` — pinned a stale `atBottom: true` viewport straight to the transcript bottom. The trackers are plain non-reactive lets now, the effect distinguishes a history prepend (first message id changes, last id unchanged) from an append, and a prepend only engages stick-to-bottom when the viewport's live pre-mutation geometry genuinely sits at the bottom, never off the rAF-deferred flag alone. Relatedly, a glide can outlive its guard (the scroll-quiet backstop can settle under main-thread jank while the compositor animation keeps running), so `handleLoadHistory` now pins the current position with an instant scroll whenever `finishUserScrollGuard()` had nothing to finish — the capture is guaranteed a parked viewport either way.

  Review of that work closed three more gaps on the same surface:
  - **The virtualized auto-stick guard measured against the wrong extent, and a rejected prepend did not stay rejected.** Virtualized `scrollSize` is derived from the render rows, which have already grown by the time the pre-DOM effect runs, so the guard compared a pre-mutation `scrollTop` against a post-mutation extent and rejected effectively every virtualized prepend — including one from a viewport genuinely parked at the bottom. It now measures against the viewport's real pre-mutation extent, and the guard's decision is latched so the reruns that virtual-row measurement triggers (which carry no growth and so cannot re-derive the prepend classification) cannot fall through it. Together these stop a consumer-driven virtualized prepend from snapping a stale `atBottom: true` viewport to the bottom, without disturbing the genuinely-at-bottom pin.
  - **A late loader resolution could re-anchor a viewport the user had already moved.** The retained post-settle anchor snapshot is now dropped the moment another scroll owner takes the viewport — jump-to-latest, submit, `scrollToBottom()`, `scrollToTop()`, search navigation, or a user scroll observed before the prepend rendered. Those paths reset the very scroll flags the correction used as its guard, so the guard read clean precisely when ownership had just changed hands.
  - **The post-settle trigger-height correction only ran when the loader resolved.** A rejection flips `isLoadingHistory` back to idle exactly as a resolution does, swapping the trigger row's height above the anchor, and the bounded stabilization loop has long since retired by the time a failure arrives. The flip and the correction now live in one helper used by every exit from a history load.

  The new `history-prepend-stress` playground example reproduces the downstream geometry (adapter-mode load-earlier in a full-height shell whose header content grows when a load completes), and its harness test asserts the anchor holds on every rendered frame across idle → loading → idle → unmounted trigger states.

## 0.8.0

### Minor Changes

- [#1250](https://github.com/stevekinney/cinder/pull/1250) [`6ef9a0d`](https://github.com/stevekinney/cinder/commit/6ef9a0db9d3719cf32c06fafce8ccdd9d9e61e45) Thanks [@stevekinney](https://github.com/stevekinney)! - Bump Chat's `conversationalist` dependency to `^0.6.0` and re-export the new branch-rewind builders — `rewindBeforeMessage`, `rewindBeforePosition`, and the `RewindOptions` type — from the package root alongside the existing builder family.

  The dependency bump is consumer-visible in two ways. `updateStreamingMessage` (re-exported via `@lostgradient/chat`) now guards against writing to a message that is no longer streaming, so the late-token-after-stop race no-ops at the library boundary instead of every consumer hand-rolling a `shouldStop()` guard. And the rewind helpers are the operation Chat's own `editMessage` adapter command asks consumers to perform — rewind to just before the edited message, discard the superseded branch, re-send — which previously required assembling `ids`/`messages`/`updatedAt` by hand.

### Patch Changes

- Updated dependencies [[`0db00f8`](https://github.com/stevekinney/cinder/commit/0db00f891e94ab9c9c4776af1608654b03003de0), [`649a5ee`](https://github.com/stevekinney/cinder/commit/649a5eea8056501f009aeee2b7f32e52ed67c595)]:
  - @lostgradient/cinder@0.23.0

## 0.7.1

### Patch Changes

- [#1242](https://github.com/stevekinney/cinder/pull/1242) [`791094c`](https://github.com/stevekinney/cinder/commit/791094c2d2e441ae496db0e5d3613dda7971ce76) Thanks [@stevekinney](https://github.com/stevekinney)! - Make virtualized scrollToTop()/scrollToBottom() actually navigate the transcript: guard settlement is now target-aware, so a stale scrollend left in flight by an auto-stick bottom correction can no longer settle the user-scroll guard mid-animation and let the next remeasurement re-pin the viewport to the bottom.

- [#1246](https://github.com/stevekinney/cinder/pull/1246) [`a4875f8`](https://github.com/stevekinney/cinder/commit/a4875f8990a96a89cc99af5a6b51b7452de81eb6) Thanks [@stevekinney](https://github.com/stevekinney)! - Export typed immutable helpers for marking failed message delivery and clearing
  the marker after a successful retry. Document how adapter consumers keep Chat's
  Retry affordance synchronized with their conversation snapshot ([#1240](https://github.com/stevekinney/cinder/issues/1240)).

- [#1244](https://github.com/stevekinney/cinder/pull/1244) [`9059a23`](https://github.com/stevekinney/cinder/commit/9059a2352d8369f0a11f47dee20ee430f2cd0cf8) Thanks [@stevekinney](https://github.com/stevekinney)! - Fix the history-prepend anchoring race when older messages are requested while a guarded programmatic scroll (most commonly a smooth scroll-to-top glide — the top is where the load-earlier trigger lives) is still animating ([#1237](https://github.com/stevekinney/cinder/issues/1237)).

  The capture used to snapshot a still-moving viewport, and the glide's smooth-scroll animation — with its absolute target of `scrollTop: 0`, where browsers also suppress native scroll anchoring — then raced Chat's instant restore corrections. Whichever landed last won: the restore could strand the viewport mid-transcript, or the glide could finish at 0 so the visible transcript shifted down by exactly the prepended block's height (with a [#911](https://github.com/stevekinney/cinder/issues/911)-style overshoot as the third possible interleaving).

  `useChatScrollState` guarded scrolls now record their destination, and a new `finishUserScrollGuard()` completes an in-flight guarded scroll instantly at that destination (aborting the browser's animation) — `handleLoadHistory` calls it before capturing, so the capture always snapshots a parked viewport and the restore has nothing left to race. Loading earlier history mid-glide now deterministically parks the viewport at the old top with the previously visible content exactly where it was, the prepended block above it.

- [#1239](https://github.com/stevekinney/cinder/pull/1239) [`742b43a`](https://github.com/stevekinney/cinder/commit/742b43a6f957744dc948c86f92df5697b4064d08) Thanks [@stevekinney](https://github.com/stevekinney)! - Single-flight message retries at the dispatch layer and expose a guarded programmatic `retryMessage(messageId)` on the Chat instance, so a second retry for an id whose retry is still in flight is ignored regardless of entry point (UI Retry button or direct call).

- [#1247](https://github.com/stevekinney/cinder/pull/1247) [`b6e8f6b`](https://github.com/stevekinney/cinder/commit/b6e8f6bd47ac82890f0c55a1137c588b65814fb8) Thanks [@stevekinney](https://github.com/stevekinney)! - Avoid repeated virtualized bottom corrections when the transcript is already settled at the bottom after row measurement.

- [#1245](https://github.com/stevekinney/cinder/pull/1245) [`4b6ca9f`](https://github.com/stevekinney/cinder/commit/4b6ca9fe2810a91b1aec4e6c21a4972f7b0bab34) Thanks [@stevekinney](https://github.com/stevekinney)! - Preload the markdown rendering pipeline when streaming begins so the first streamed message is formatted without a cold-import delay ([#1238](https://github.com/stevekinney/cinder/issues/1238)).

## 0.7.0

### Minor Changes

- Widen internal peer ranges to follow the coordinated release.

### Patch Changes

- Updated dependencies [[`8069fc5`](https://github.com/stevekinney/cinder/commit/8069fc5cf551a7cea8481136703e3dbb10d9db05), [`8069fc5`](https://github.com/stevekinney/cinder/commit/8069fc5cf551a7cea8481136703e3dbb10d9db05), [`539d240`](https://github.com/stevekinney/cinder/commit/539d240ac2a752136a95f09ff3e2b94111e969a4), [`539d240`](https://github.com/stevekinney/cinder/commit/539d240ac2a752136a95f09ff3e2b94111e969a4), [`8069fc5`](https://github.com/stevekinney/cinder/commit/8069fc5cf551a7cea8481136703e3dbb10d9db05), [`28113fc`](https://github.com/stevekinney/cinder/commit/28113fcceb35150ece09325bcf627bf0931e9871), [`3641205`](https://github.com/stevekinney/cinder/commit/3641205ff964173a7c2913b77f8511e94fb0896d), [`8069fc5`](https://github.com/stevekinney/cinder/commit/8069fc5cf551a7cea8481136703e3dbb10d9db05), [`8069fc5`](https://github.com/stevekinney/cinder/commit/8069fc5cf551a7cea8481136703e3dbb10d9db05), [`539d240`](https://github.com/stevekinney/cinder/commit/539d240ac2a752136a95f09ff3e2b94111e969a4), [`8069fc5`](https://github.com/stevekinney/cinder/commit/8069fc5cf551a7cea8481136703e3dbb10d9db05), [`8069fc5`](https://github.com/stevekinney/cinder/commit/8069fc5cf551a7cea8481136703e3dbb10d9db05), [`8069fc5`](https://github.com/stevekinney/cinder/commit/8069fc5cf551a7cea8481136703e3dbb10d9db05)]:
  - @lostgradient/cinder@0.22.0

## 0.6.0

### Minor Changes

- [#1222](https://github.com/stevekinney/cinder/pull/1222) [`e86d40e`](https://github.com/stevekinney/cinder/commit/e86d40e79d0b313feeabd85f33b1dc6dded942a3) Thanks [@stevekinney](https://github.com/stevekinney)! - Widen Editor's and Chat's peer ranges to the Cinder and Markdown minors releasing
  alongside them: `@lostgradient/cinder` `^0.20.0` → `^0.21.0`, and
  `@lostgradient/markdown` `^0.1.0` → `^0.2.0`.

  Without this the release ships Editor and Chat declaring peer ranges that exclude
  the very Cinder and Markdown versions published in the same batch — `^0.1.0`
  resolves to `>=0.1.0 <0.2.0` under semver's 0.x rule, so Markdown 0.2.0 falls
  outside it, and every consumer installing the set together gets an unmet-peer
  error. This is a coordinated minor across all four packages, which is also what
  the package-boundary tests' `pendingCoordinatedMinorRelease` escape expects.

- [#1220](https://github.com/stevekinney/cinder/pull/1220) [`68370b1`](https://github.com/stevekinney/cinder/commit/68370b1d5ac2046855a77f95db36f316eaafa35a) Thanks [@stevekinney](https://github.com/stevekinney)! - Add scroll-driven edge fades and a horizontal-scroll shadow affordance, and fix a forced-colors defect in the existing overlay-body fade.
  - New shared internal partial `_scroll-fade.css`: an opaque, scroll-position-aware edge fade driven by `animation-timeline: scroll()` where supported, falling back to the existing `data-cinder-overflows` attribute path everywhere else — no `CSS.supports()` branch, no hydration divergence. Never a `mask-image` (masking a container that paints its own background reveals whatever is behind it, which is why PR [#972](https://github.com/stevekinney/cinder/issues/972) removed masks from Modal/Drawer/Sheet in the first place).
  - Modal, Drawer, and Sheet bodies now consume the shared recipe instead of three byte-identical copies, which also fixes a real bug: the previous hard-coded gradient had no `forced-colors` carve-out, so it painted a light-gray band across the bottom of every scrollable overlay in high-contrast mode. `--cinder-scroll-fade-size` (1.5rem) is now a themeable public token instead of being hard-coded three times.
  - `overflowFade()` (`utilities/attachments.ts`) no longer registers a `ResizeObserver` on every descendant of a scroll container — only the container itself, with a `MutationObserver` triggering direct re-measurement on content changes. The previous approach was fine for a modal body but registered thousands of observers on a long scroll surface.
  - New opt-in `scrollFadeVisible` prop on `ScrollArea`, `CodeBlock`, and Chat's message timeline — presentation-only, never the sole signal that content scrolls. `CodeBlock`'s fade is horizontal (inline) and intentionally translucent rather than fully opaque, so a partially covered glyph still reads as a glyph. Chat's timeline fades both the top and bottom edges and is only active in `surfaceMode="default"`.
  - `Table`, `PermissionMatrix`, and `TransferList` scroll containers now show `DataGrid`'s existing inset-shadow horizontal(/vertical, for TransferList)-scroll affordance when their content actually overflows, via a new `overflowShadow()` attachment.

### Patch Changes

- Updated dependencies [[`bf6eeb9`](https://github.com/stevekinney/cinder/commit/bf6eeb9e6c287f360c6ed4fe9a0ded7a909e4b8a), [`bf6eeb9`](https://github.com/stevekinney/cinder/commit/bf6eeb9e6c287f360c6ed4fe9a0ded7a909e4b8a), [`bf6eeb9`](https://github.com/stevekinney/cinder/commit/bf6eeb9e6c287f360c6ed4fe9a0ded7a909e4b8a), [`bf6eeb9`](https://github.com/stevekinney/cinder/commit/bf6eeb9e6c287f360c6ed4fe9a0ded7a909e4b8a), [`06ffb18`](https://github.com/stevekinney/cinder/commit/06ffb181cf73c2984613f93571b037dd721c7734), [`61bcfbc`](https://github.com/stevekinney/cinder/commit/61bcfbce232427b03b7d11ae552c134800d026a4), [`68370b1`](https://github.com/stevekinney/cinder/commit/68370b1d5ac2046855a77f95db36f316eaafa35a), [`38a43a0`](https://github.com/stevekinney/cinder/commit/38a43a0cccf557aafbaee2a39486a050a2979854), [`0fb8912`](https://github.com/stevekinney/cinder/commit/0fb891210be26c2675de870beb931d9f39cdff4c), [`4531af8`](https://github.com/stevekinney/cinder/commit/4531af81295cec74f50a20b33fa45492ee037bc4)]:
  - @lostgradient/cinder@0.21.0
  - @lostgradient/markdown@0.2.0

## 0.5.0

### Minor Changes

- [#1001](https://github.com/stevekinney/cinder/pull/1001) [`7f924e1`](https://github.com/stevekinney/cinder/commit/7f924e1c3f4eca10530606d14bf6c8778f998455) Thanks [@stevekinney](https://github.com/stevekinney)! - Standardize component prop API vocabulary across handlers, bindable values,
  boolean props, polymorphic `as` props, and component names. This removes
  `defaultValue` public props in favor of bindable `value`, splits value
  interceptors to `onValueChangeRequest`, renames lowercase custom callbacks to
  camelCase notification props, and adds an AST guard that prevents these
  conventions from drifting.

### Patch Changes

- [#917](https://github.com/stevekinney/cinder/pull/917) [`195ffd6`](https://github.com/stevekinney/cinder/commit/195ffd6aa1bd61f86c46e1266a46664af5b3a8d0) Thanks [@stevekinney](https://github.com/stevekinney)! - Preserve the visible transcript position when non-virtualized history is prepended.

- [#918](https://github.com/stevekinney/cinder/pull/918) [`bcc1bcf`](https://github.com/stevekinney/cinder/commit/bcc1bcf6ffbd6f4ff5e4e89a75c7f36f3eb18aca) Thanks [@stevekinney](https://github.com/stevekinney)! - Prevent the participant typing indicator from flex-collapsing when the transcript overflows.

- [#1112](https://github.com/stevekinney/cinder/pull/1112) [`cdd0215`](https://github.com/stevekinney/cinder/commit/cdd0215ae3f843c5d0ebf665a3791400ebc904d6) Thanks [@stevekinney](https://github.com/stevekinney)! - Document the distinct ownership boundaries for editor and Cinder diff viewers plus Cinder and Chat message surfaces.

- [#1022](https://github.com/stevekinney/cinder/pull/1022) [`6bd8d76`](https://github.com/stevekinney/cinder/commit/6bd8d76074bf471898a476bde91041a7cc9ca047) Thanks [@stevekinney](https://github.com/stevekinney)! - Use a directional chevron icon for MenuBar submenu indicators.

- [#997](https://github.com/stevekinney/cinder/pull/997) [`a96c5c0`](https://github.com/stevekinney/cinder/commit/a96c5c09fd5ef025d79d97006bd6ea0b71a78db3) Thanks [@stevekinney](https://github.com/stevekinney)! - Preserve deferred history anchors across expected restoration scrolls.

- [#972](https://github.com/stevekinney/cinder/pull/972) [`7b9be9d`](https://github.com/stevekinney/cinder/commit/7b9be9d9d76024df7af698f96e760c725af2dd9a) Thanks [@stevekinney](https://github.com/stevekinney)! - Strengthen light and dark surface hierarchy, standardize form-control fills, and enforce muted interior dividers with stylelint guardrails.

- Updated dependencies [[`9faa142`](https://github.com/stevekinney/cinder/commit/9faa1422658ceddac3b758e313be3c2d6696bada), [`7ab0910`](https://github.com/stevekinney/cinder/commit/7ab091009749ccaf39b24ce3548b7374c2353e92), [`67f51a7`](https://github.com/stevekinney/cinder/commit/67f51a73a603d04f1858050a60abfed793a0a178), [`899801b`](https://github.com/stevekinney/cinder/commit/899801bdb9192e0b62799c184b74681fbfb72136), [`dca8fbf`](https://github.com/stevekinney/cinder/commit/dca8fbfd7fb5fad5cb429e346e5f13e9af789518), [`92d17da`](https://github.com/stevekinney/cinder/commit/92d17da743f17902a87645cd5c92b8b0ce35e4c4), [`a1f1880`](https://github.com/stevekinney/cinder/commit/a1f1880703e0e0f941b4a348555f009af9630796), [`8ea6973`](https://github.com/stevekinney/cinder/commit/8ea69733a09812ee81ace349d4289e3011ad07b2), [`91eb73c`](https://github.com/stevekinney/cinder/commit/91eb73c6a336e652b7033f75a1c27d051c18a4de), [`cf18ed7`](https://github.com/stevekinney/cinder/commit/cf18ed74fd31ebc90b2a06fa36a7c2588b529e92), [`7f6de70`](https://github.com/stevekinney/cinder/commit/7f6de7056bbfe347aa7b7fe019efaea8bc06c6f0), [`76c3da6`](https://github.com/stevekinney/cinder/commit/76c3da6ccc1356dfa0687129fe1b3bfb40f7a4ce), [`4766190`](https://github.com/stevekinney/cinder/commit/47661907620f26eb61f50b3592c73c013b94e6ea), [`6983b8e`](https://github.com/stevekinney/cinder/commit/6983b8e8c00a05e948ff0f02abe4d50c6c7e0a30), [`c58514f`](https://github.com/stevekinney/cinder/commit/c58514f6c636695e795c93867f508a896ec9aa32), [`5ff29c6`](https://github.com/stevekinney/cinder/commit/5ff29c6acdd8040e09b613f1cb05cccea2713c24), [`c5d2235`](https://github.com/stevekinney/cinder/commit/c5d22353105f1ea52cefc8ad34a1e348342094f7), [`fca6b6a`](https://github.com/stevekinney/cinder/commit/fca6b6a3c9aa212c84f37cf15d63a1962c37eeef), [`761cd8e`](https://github.com/stevekinney/cinder/commit/761cd8e9ea529866a32e0496699917822c20b1c1), [`16671d8`](https://github.com/stevekinney/cinder/commit/16671d86f9b467ddae8f9aee5b36ed1d0d662d84), [`6418308`](https://github.com/stevekinney/cinder/commit/641830824c085af3cb50e24075bbebef75d99f78), [`115705d`](https://github.com/stevekinney/cinder/commit/115705d23092b7663d3045a07327b04b2e77d1fc), [`6bffc7d`](https://github.com/stevekinney/cinder/commit/6bffc7d07e6c7d390a6f111bc85f396201fc36e0), [`abce2be`](https://github.com/stevekinney/cinder/commit/abce2bedbef200211a2aa1f19b8643949cb0291f), [`b22ee52`](https://github.com/stevekinney/cinder/commit/b22ee527c2cab50b2eec851e0b8991316d8a0d21), [`05f9d06`](https://github.com/stevekinney/cinder/commit/05f9d0632018b8ba8c2cdfd5c1ad9bcaa149820c), [`7ec4689`](https://github.com/stevekinney/cinder/commit/7ec46892c9d467f932fe32086a6e47312a48b107), [`1fb92e0`](https://github.com/stevekinney/cinder/commit/1fb92e05faf5660103124a8520aaa31443286746), [`1a9b577`](https://github.com/stevekinney/cinder/commit/1a9b5779c07023ca263d8a34f0365307d00129af), [`e1a27b8`](https://github.com/stevekinney/cinder/commit/e1a27b82c650fc8efe71598227e9afad94cb2188), [`898dcda`](https://github.com/stevekinney/cinder/commit/898dcda4009d7d7c21b51ad35c2c7e549f568fdd), [`cdd0215`](https://github.com/stevekinney/cinder/commit/cdd0215ae3f843c5d0ebf665a3791400ebc904d6), [`76759d3`](https://github.com/stevekinney/cinder/commit/76759d3175b26b664d345e803c7ec5431516aa51), [`81f7b91`](https://github.com/stevekinney/cinder/commit/81f7b91c8c8e80be88a058f47bb3547fd716abd2), [`e113c49`](https://github.com/stevekinney/cinder/commit/e113c49dd2206e1893c0ba970d0f182fbdf0b20c), [`323399a`](https://github.com/stevekinney/cinder/commit/323399ab5e8bbbb7f2118d5163bb607db71340b8), [`6130fbb`](https://github.com/stevekinney/cinder/commit/6130fbbb97181e26df63e080a070567f5d964c8b), [`b12595e`](https://github.com/stevekinney/cinder/commit/b12595e2a16db3d497fcbb5a831db95a9ac84187), [`a1b532b`](https://github.com/stevekinney/cinder/commit/a1b532b827a6304c249eb32e3d1b226d31c2b602), [`5ff75da`](https://github.com/stevekinney/cinder/commit/5ff75da61a812351849333db0f51abef4ac71896), [`b26c1b4`](https://github.com/stevekinney/cinder/commit/b26c1b4089030a0b995fe66339df376634af5c7a), [`490098c`](https://github.com/stevekinney/cinder/commit/490098c0d8647bae9e51177ac6e1017456ec73a2), [`74a58e6`](https://github.com/stevekinney/cinder/commit/74a58e6cc68f7b5db632090f80e0f81a7d62c66b), [`5bf2b09`](https://github.com/stevekinney/cinder/commit/5bf2b09d59b62dc7cd61b01aafd076c5133977ca), [`dc90b46`](https://github.com/stevekinney/cinder/commit/dc90b4675e59f263ea6ee402e5375ec01fa9620b), [`4a279a2`](https://github.com/stevekinney/cinder/commit/4a279a28b9423559e6e33fe5123696a275ea2006), [`b12595e`](https://github.com/stevekinney/cinder/commit/b12595e2a16db3d497fcbb5a831db95a9ac84187), [`44e11a5`](https://github.com/stevekinney/cinder/commit/44e11a52cd1b1169dc2dd075964114aa32f318d4), [`2b92897`](https://github.com/stevekinney/cinder/commit/2b92897a03395096d185d6545435fb2554bbd0f7), [`d4a63dc`](https://github.com/stevekinney/cinder/commit/d4a63dcf0d40d9f6dae52962a8a30e6893c1675d), [`06d7002`](https://github.com/stevekinney/cinder/commit/06d7002e9a0356dd922eb236772e06789a978b6f), [`b33f757`](https://github.com/stevekinney/cinder/commit/b33f7575e87f1226f603f2e122fae3942a3d349f), [`6166a73`](https://github.com/stevekinney/cinder/commit/6166a73d90e71745d4357a2a0d3a536d327b10a7), [`e81880b`](https://github.com/stevekinney/cinder/commit/e81880b47717b07fb83830faee4ee91204d16727), [`876c600`](https://github.com/stevekinney/cinder/commit/876c60083dc674b648f47c99aeff59d62e15b4aa), [`6bd8d76`](https://github.com/stevekinney/cinder/commit/6bd8d76074bf471898a476bde91041a7cc9ca047), [`41fdd11`](https://github.com/stevekinney/cinder/commit/41fdd11644884db69b7cffe8ee9bf1b1921d8974), [`40bd219`](https://github.com/stevekinney/cinder/commit/40bd219c80a4411f81d82a2105f477c1554a45dd), [`412f275`](https://github.com/stevekinney/cinder/commit/412f27521e7f339c5e62649c3980eeb355f38cd7), [`f5d2ec6`](https://github.com/stevekinney/cinder/commit/f5d2ec62a878282f9faa10c9c3d67819b77f7213), [`a96c5c0`](https://github.com/stevekinney/cinder/commit/a96c5c09fd5ef025d79d97006bd6ea0b71a78db3), [`462b85b`](https://github.com/stevekinney/cinder/commit/462b85b8cad5859bbcd97c86428fc10d839aa255), [`a39d748`](https://github.com/stevekinney/cinder/commit/a39d74892a06cae40f13aa663f0d250598cc094b), [`2dc6c75`](https://github.com/stevekinney/cinder/commit/2dc6c75fcbb74a87d8fc179ca4f16c24b93055f6), [`2dc6c75`](https://github.com/stevekinney/cinder/commit/2dc6c75fcbb74a87d8fc179ca4f16c24b93055f6), [`2dc6c75`](https://github.com/stevekinney/cinder/commit/2dc6c75fcbb74a87d8fc179ca4f16c24b93055f6), [`2dc6c75`](https://github.com/stevekinney/cinder/commit/2dc6c75fcbb74a87d8fc179ca4f16c24b93055f6), [`2dc6c75`](https://github.com/stevekinney/cinder/commit/2dc6c75fcbb74a87d8fc179ca4f16c24b93055f6), [`2dc6c75`](https://github.com/stevekinney/cinder/commit/2dc6c75fcbb74a87d8fc179ca4f16c24b93055f6), [`2dc6c75`](https://github.com/stevekinney/cinder/commit/2dc6c75fcbb74a87d8fc179ca4f16c24b93055f6), [`2dc6c75`](https://github.com/stevekinney/cinder/commit/2dc6c75fcbb74a87d8fc179ca4f16c24b93055f6), [`7d069b6`](https://github.com/stevekinney/cinder/commit/7d069b6cac6287737fa7623c8e8b3e99249e1ea8), [`dbcc986`](https://github.com/stevekinney/cinder/commit/dbcc986919d2bddb3dd4e3bda0c2089699595dfc), [`925a0fc`](https://github.com/stevekinney/cinder/commit/925a0fc905c80ec6663f22d908d31ad7d3fdbe9a), [`3897000`](https://github.com/stevekinney/cinder/commit/389700023af97651b11ff4bf1d21962a935a76ba), [`034413c`](https://github.com/stevekinney/cinder/commit/034413cf9591d1c31ad439349cab6d0bbed6df5a), [`7f924e1`](https://github.com/stevekinney/cinder/commit/7f924e1c3f4eca10530606d14bf6c8778f998455), [`d99561f`](https://github.com/stevekinney/cinder/commit/d99561fe37c49ef4791109e220d242cde11b67db), [`e7e92ad`](https://github.com/stevekinney/cinder/commit/e7e92ad8d59b11864bb10a5f915afc5ddacfc192), [`42262d1`](https://github.com/stevekinney/cinder/commit/42262d1f7378ce6c85dc4ac60123991fee0004a1), [`4c6455c`](https://github.com/stevekinney/cinder/commit/4c6455c84e97cce49a2e2defd8f823e2903e8a0f), [`f621c7e`](https://github.com/stevekinney/cinder/commit/f621c7e0fd98dd76982575c5e55ae901018bcb55), [`277503a`](https://github.com/stevekinney/cinder/commit/277503a78d7b3cdad23a6b3b10ad4b7ea4a1415d), [`3b3685f`](https://github.com/stevekinney/cinder/commit/3b3685f63ca518a6006a5212c78c837b2e4ba91f), [`fad8c3f`](https://github.com/stevekinney/cinder/commit/fad8c3f7a5a618534c71b413a82db7d88f290c0f), [`928ce6a`](https://github.com/stevekinney/cinder/commit/928ce6a3e26a0a101f1cb7a8b6a94d6708a88ab9), [`057b1ee`](https://github.com/stevekinney/cinder/commit/057b1ee1d0a1f82eed05e682565fc8d7d6f9745a), [`cfc7fa8`](https://github.com/stevekinney/cinder/commit/cfc7fa80cfa2e21150830c7f66d68b78da37f99e), [`09ab845`](https://github.com/stevekinney/cinder/commit/09ab8459df15bcdbddec2737e0f98bafb1c2f796), [`4aa510d`](https://github.com/stevekinney/cinder/commit/4aa510d7a59382a53c1344ba79df43313b91fde9), [`4fe3131`](https://github.com/stevekinney/cinder/commit/4fe313159e6ee88d13ec6a10a15acb5347c00bbe), [`a73801c`](https://github.com/stevekinney/cinder/commit/a73801c4ffc5d651e358b9e36fea9fb51dcf3059), [`f59f9f9`](https://github.com/stevekinney/cinder/commit/f59f9f93ce3f209a20e46ebb1891b5ebeeec757e), [`1f6f63e`](https://github.com/stevekinney/cinder/commit/1f6f63e78b1f23a6000d8ffba790976804f43b49), [`cb2e132`](https://github.com/stevekinney/cinder/commit/cb2e13237a014058a5adbad8a6ff1768040f25a1), [`7b9be9d`](https://github.com/stevekinney/cinder/commit/7b9be9d9d76024df7af698f96e760c725af2dd9a), [`912c785`](https://github.com/stevekinney/cinder/commit/912c785c93286da98c93f58e38e7e13ae5614292), [`74a58e6`](https://github.com/stevekinney/cinder/commit/74a58e6cc68f7b5db632090f80e0f81a7d62c66b), [`0a43737`](https://github.com/stevekinney/cinder/commit/0a43737b4cc04a8d13628fbb47879fb5f5ba117b), [`5b640a3`](https://github.com/stevekinney/cinder/commit/5b640a3b043c33667a243c526c79ddd72e6912a2), [`dc3dc20`](https://github.com/stevekinney/cinder/commit/dc3dc20153e59b03cceb5c0d6c505111af44f4e9), [`c5bd054`](https://github.com/stevekinney/cinder/commit/c5bd05414313548118fe9c8aa5eab645ba1ec6dd), [`43eb35b`](https://github.com/stevekinney/cinder/commit/43eb35bb96c50cefdeb61c121a540eec5049fc9f)]:
  - @lostgradient/cinder@0.20.0

## 0.4.1

### Patch Changes

- [#902](https://github.com/stevekinney/cinder/pull/902) [`a9bacbf`](https://github.com/stevekinney/cinder/commit/a9bacbf724c9040d3793f2eb98d5916204a8275c) Thanks [@stevekinney](https://github.com/stevekinney)! - Ignore push callbacks that arrive after a Chat adapter subscription is torn down.

- [#893](https://github.com/stevekinney/cinder/pull/893) [`7ca62f6`](https://github.com/stevekinney/cinder/commit/7ca62f657805c581f1e17c75e9e23ae9744c0637) Thanks [@stevekinney](https://github.com/stevekinney)! - Improve chat artifact and composer accessibility: code artifacts now use Cinder's syntax-highlighted `CodeBlock` by default with an optional `codeRenderer` hook, and the programmatic attachment input is hidden from the accessibility tree.

- [#894](https://github.com/stevekinney/cinder/pull/894) [`1085170`](https://github.com/stevekinney/cinder/commit/1085170117680bda4c7d372bbdef894808f704b7) Thanks [@stevekinney](https://github.com/stevekinney)! - Keep stale bottom-sentinel observations from undoing an in-flight programmatic scroll away from the bottom.

- [#909](https://github.com/stevekinney/cinder/pull/909) [`e495c45`](https://github.com/stevekinney/cinder/commit/e495c456b24e42ec23433428ba89d152cc33d059) Thanks [@stevekinney](https://github.com/stevekinney)! - Re-export Conversationalist's tool-call and tool-result transcript builders from the Chat package.

- [#903](https://github.com/stevekinney/cinder/pull/903) [`8329ec8`](https://github.com/stevekinney/cinder/commit/8329ec8361b28ed622098c1d3bcb61520cebd466) Thanks [@stevekinney](https://github.com/stevekinney)! - Warn when Chat receives a conversation history stamped with a newer schema version.

- [#892](https://github.com/stevekinney/cinder/pull/892) [`5bf73b2`](https://github.com/stevekinney/cinder/commit/5bf73b2e4a08fb3ad8bc82f895d5b756a1c2a65a) Thanks [@stevekinney](https://github.com/stevekinney)! - Document the `chat-message-action-button` class contract for native buttons rendered through `messageActions`.

- [#904](https://github.com/stevekinney/cinder/pull/904) [`a67ffaa`](https://github.com/stevekinney/cinder/commit/a67ffaa7c2d3b9a580bd79c37820bd9fbd5947b3) Thanks [@stevekinney](https://github.com/stevekinney)! - Prevent concurrent retry actions for the same failed message from dispatching duplicate adapter commands.

- [#891](https://github.com/stevekinney/cinder/pull/891) [`a67820a`](https://github.com/stevekinney/cinder/commit/a67820a8bc97f777cc2c0c487c9a1b7e2dc04edf) Thanks [@stevekinney](https://github.com/stevekinney)! - Default `ChatComposerPopover` suggestions to `top-start` so menus open above bottom-anchored composers.

- Updated dependencies [[`8efb8b6`](https://github.com/stevekinney/cinder/commit/8efb8b6b27d3f705dca8b2197df2fb33f80b0339), [`eaa52b6`](https://github.com/stevekinney/cinder/commit/eaa52b6b5d359ca071df8eb5039b261c0ac4b40f), [`79cc14b`](https://github.com/stevekinney/cinder/commit/79cc14b49750cdeae92e3cb16a75bc4ef77d1582)]:
  - @lostgradient/cinder@0.19.1

## 0.4.0

### Minor Changes

- Widen the @lostgradient/cinder peer range to follow the Cinder release.

### Patch Changes

- Updated dependencies [[`cb98477`](https://github.com/stevekinney/cinder/commit/cb98477807816e19c7736e0ca875c8b1bddfe838)]:
  - @lostgradient/cinder@0.19.0

## 0.3.0

### Minor Changes

- [#871](https://github.com/stevekinney/cinder/pull/871) [`77c505d`](https://github.com/stevekinney/cinder/commit/77c505db32ece4682ea2bc153fa51007fb98db85) Thanks [@stevekinney](https://github.com/stevekinney)! - Adopt conversationalist 0.5 and expose its `createConversationHistory`, `buildMessage`, and `prependMessages` builders. The existing `createConversation` export remains as a deprecated migration alias.

### Patch Changes

- [#869](https://github.com/stevekinney/cinder/pull/869) [`20d9125`](https://github.com/stevekinney/cinder/commit/20d91259adbb32d55ffad8ea68b26f463f061d7d) Thanks [@stevekinney](https://github.com/stevekinney)! - Keep unread-message accrual synchronized after non-virtualized chats scroll to the top.

- Updated dependencies [[`e12e2e9`](https://github.com/stevekinney/cinder/commit/e12e2e97c200f4bcb8586bdc6dc2dd95a1e74dfe), [`92e7ab3`](https://github.com/stevekinney/cinder/commit/92e7ab3ff9d05176f08498c5f0948a4d6827d153), [`4bb7c93`](https://github.com/stevekinney/cinder/commit/4bb7c93ea3ad4741a515026f21197513ac4889a2)]:
  - @lostgradient/cinder@0.18.0

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
