# @lostgradient/editor

## 0.8.0

### Minor Changes

- [`8c3065a`](https://github.com/stevekinney/cinder/commit/8c3065a5889811bc3315e3a7fcbfa1bfc816b62c) Thanks [@stevekinney](https://github.com/stevekinney)! - Add `toRuntimeThreads`, the documented inverse of `toPersistedThreads`, so a saved `ReviewState` can be bound straight to ReviewEditor's `threads` prop without casting through `unknown`. It seeds `from`/`to` with a neutral unplaced sentinel and lets the anchor plugin place each thread by its quote. Both converters now preserve `anchor.type`, which fixes document-level threads being silently deleted when restored via `setState`. Anchor coordinate spaces are documented on the `threads` prop, and the `with-comments` example now seeds real ProseMirror positions instead of raw-Markdown indices.

### Patch Changes

- Updated dependencies [[`8c3065a`](https://github.com/stevekinney/cinder/commit/8c3065a5889811bc3315e3a7fcbfa1bfc816b62c)]:
  - @lostgradient/cinder@0.24.2

## 0.7.0

### Minor Changes

- [#1266](https://github.com/stevekinney/cinder/pull/1266) [`fca6dee`](https://github.com/stevekinney/cinder/commit/fca6deecda88bef233a982b8fe1eb12755aef940) Thanks [@stevekinney](https://github.com/stevekinney)! - Fix ReviewEditor's seeded-thread anchoring, wire the documented thread
  auto-delete, expose the imperative surface, and collapse the editor view's
  stacked toolbars into one row.

  Found by exercising the published package as a consumer would — rendering
  `ReviewEditor` with persisted `threads` already in the prop, which is the most
  common way an app loads a saved review.

  **Seeded threads highlighted the entire document.** Milkdown sets the initial
  document with a single step spanning the whole doc. Anchors present at that
  moment were mapped through it, so `map(from, -1)` collapsed to 0 and
  `map(to, 1)` expanded to the document end, and every seeded thread decorated
  every block. The mapping's "follow the edit" branch then overwrote the anchor's
  `quote` with the entire document text without raising `needsReanchor`, so
  deferred re-anchoring never ran and the only data that could have recovered the
  anchor was gone. A wholesale replacement now bypasses position mapping entirely
  and defers to re-anchoring, which locates anchors by quote.

  Syncing threads into the plugin also verifies each anchor against the document
  instead of trusting its `from`/`to`, and raises re-anchoring for any that do not
  check out. `from`/`to` are ProseMirror positions — not raw-Markdown indices and
  not `doc.textBetween()` offsets, which sit in the same object as
  `lastKnownOffset` — and no prop documentation said so, so seeded anchors were
  routinely in the wrong coordinate space with nothing to signal it.

  **Threads whose anchor text was deleted were never removed.** `comments/types.ts`
  documents that threads have no "orphaned" state because "When anchor text is
  deleted, threads are automatically removed". The plugin detected the condition
  and called `onAnchorDeleted`, but ReviewEditor constructed the plugin without
  that handler. The decoration vanished while the thread stayed in the bindable
  `threads` array pointing at text that no longer existed, and `onthreaddelete`
  never fired. The handler is now wired.

  **The imperative surface was unreachable.** The implementation exports ~22
  instance methods, but the public wrapper rendered it without `bind:this` and
  re-exported nothing, so `bind:this` on `<ReviewEditor>` produced a component
  with no methods — putting the whole `getState`/`setState` persistence
  round-trip out of reach from the published entry point. The wrapper now forwards
  them.

  **Announcements rendered as visible text.** `LiveRegion` hid itself with
  `class="sr-only"`; Cinder ships `.cinder-sr-only`, a bare `.sr-only` is defined
  nowhere, and the component has no `<style>` block of its own.

  **The comments toggle's `aria-controls` never resolved.** It derived the
  sidebar's id from its own (`{id}-controls`), advertising
  `{id}-controls-sidebar` while the sidebar is `{id}-sidebar`. The id is now
  passed in explicitly.

  **The editor view stacked two toolbars.** The diff view already passes
  DiffViewer an empty toolbar snippet ("controls are in the unified bar above")
  and the summary view passes `showToolbar={false}`, but the editor view passed
  neither — costing ~90px of chrome before any document content. The formatting
  controls now render inside the unified bar, halving that to ~41px.

  To make that possible, `MarkdownEditor` gains `ontoolbarcontextchange`, and
  `ToolbarContext` now also carries `onUndo`, `onRedo`, `onLinkClick`, and
  `linkPopoverOpen`. Both are additive. The handlers close a real gap: the
  documented `toolbar` snippet claims to replace the default toolbar, but without
  them a caller could not reproduce undo, redo, or the link popover.

  The unified bar's `role` changes from `toolbar` to `group`. It contains a
  `tablist` — never a valid child of `toolbar` — and now the editor's own
  `toolbar`, and a `toolbar` may not nest inside a `toolbar`. A labelled `group`
  describes what the bar is and keeps its children valid.

### Patch Changes

- Updated dependencies [[`c89a8b8`](https://github.com/stevekinney/cinder/commit/c89a8b88b62349baadeaf205546dcc3cca139613)]:
  - @lostgradient/cinder@0.24.1

## 0.6.0

### Minor Changes

- Widen internal peer ranges to follow the coordinated release.

### Patch Changes

- Updated dependencies [[`d13d4cd`](https://github.com/stevekinney/cinder/commit/d13d4cd39bea7b3024793ea8996021b2c8eafc68), [`b0583e2`](https://github.com/stevekinney/cinder/commit/b0583e2e0a44a3757000167ac4cc4171f5a7473b)]:
  - @lostgradient/cinder@0.24.0

## 0.5.0

### Minor Changes

- Widen internal peer ranges to follow the coordinated release.

### Patch Changes

- Updated dependencies [[`0db00f8`](https://github.com/stevekinney/cinder/commit/0db00f891e94ab9c9c4776af1608654b03003de0), [`649a5ee`](https://github.com/stevekinney/cinder/commit/649a5eea8056501f009aeee2b7f32e52ed67c595)]:
  - @lostgradient/cinder@0.23.0

## 0.4.0

### Minor Changes

- [#1232](https://github.com/stevekinney/cinder/pull/1232) [`539d240`](https://github.com/stevekinney/cinder/commit/539d240ac2a752136a95f09ff3e2b94111e969a4) Thanks [@stevekinney](https://github.com/stevekinney)! - Add unified-diff copy to DiffViewer and move secondary MarkdownEditor formatting controls into a labeled overflow popover so editor toolbars never wrap.

### Patch Changes

- Updated dependencies [[`8069fc5`](https://github.com/stevekinney/cinder/commit/8069fc5cf551a7cea8481136703e3dbb10d9db05), [`8069fc5`](https://github.com/stevekinney/cinder/commit/8069fc5cf551a7cea8481136703e3dbb10d9db05), [`539d240`](https://github.com/stevekinney/cinder/commit/539d240ac2a752136a95f09ff3e2b94111e969a4), [`539d240`](https://github.com/stevekinney/cinder/commit/539d240ac2a752136a95f09ff3e2b94111e969a4), [`8069fc5`](https://github.com/stevekinney/cinder/commit/8069fc5cf551a7cea8481136703e3dbb10d9db05), [`28113fc`](https://github.com/stevekinney/cinder/commit/28113fcceb35150ece09325bcf627bf0931e9871), [`3641205`](https://github.com/stevekinney/cinder/commit/3641205ff964173a7c2913b77f8511e94fb0896d), [`8069fc5`](https://github.com/stevekinney/cinder/commit/8069fc5cf551a7cea8481136703e3dbb10d9db05), [`8069fc5`](https://github.com/stevekinney/cinder/commit/8069fc5cf551a7cea8481136703e3dbb10d9db05), [`539d240`](https://github.com/stevekinney/cinder/commit/539d240ac2a752136a95f09ff3e2b94111e969a4), [`8069fc5`](https://github.com/stevekinney/cinder/commit/8069fc5cf551a7cea8481136703e3dbb10d9db05), [`8069fc5`](https://github.com/stevekinney/cinder/commit/8069fc5cf551a7cea8481136703e3dbb10d9db05), [`8069fc5`](https://github.com/stevekinney/cinder/commit/8069fc5cf551a7cea8481136703e3dbb10d9db05)]:
  - @lostgradient/cinder@0.22.0

## 0.3.0

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

### Patch Changes

- Updated dependencies [[`bf6eeb9`](https://github.com/stevekinney/cinder/commit/bf6eeb9e6c287f360c6ed4fe9a0ded7a909e4b8a), [`bf6eeb9`](https://github.com/stevekinney/cinder/commit/bf6eeb9e6c287f360c6ed4fe9a0ded7a909e4b8a), [`bf6eeb9`](https://github.com/stevekinney/cinder/commit/bf6eeb9e6c287f360c6ed4fe9a0ded7a909e4b8a), [`bf6eeb9`](https://github.com/stevekinney/cinder/commit/bf6eeb9e6c287f360c6ed4fe9a0ded7a909e4b8a), [`06ffb18`](https://github.com/stevekinney/cinder/commit/06ffb181cf73c2984613f93571b037dd721c7734), [`61bcfbc`](https://github.com/stevekinney/cinder/commit/61bcfbce232427b03b7d11ae552c134800d026a4), [`68370b1`](https://github.com/stevekinney/cinder/commit/68370b1d5ac2046855a77f95db36f316eaafa35a), [`38a43a0`](https://github.com/stevekinney/cinder/commit/38a43a0cccf557aafbaee2a39486a050a2979854), [`0fb8912`](https://github.com/stevekinney/cinder/commit/0fb891210be26c2675de870beb931d9f39cdff4c), [`4531af8`](https://github.com/stevekinney/cinder/commit/4531af81295cec74f50a20b33fa45492ee037bc4)]:
  - @lostgradient/cinder@0.21.0
  - @lostgradient/markdown@0.2.0

## 0.2.0

### Minor Changes

- [#1001](https://github.com/stevekinney/cinder/pull/1001) [`7f924e1`](https://github.com/stevekinney/cinder/commit/7f924e1c3f4eca10530606d14bf6c8778f998455) Thanks [@stevekinney](https://github.com/stevekinney)! - Standardize component prop API vocabulary across handlers, bindable values,
  boolean props, polymorphic `as` props, and component names. This removes
  `defaultValue` public props in favor of bindable `value`, splits value
  interceptors to `onValueChangeRequest`, renames lowercase custom callbacks to
  camelCase notification props, and adds an AST guard that prevents these
  conventions from drifting.

### Patch Changes

- [#1112](https://github.com/stevekinney/cinder/pull/1112) [`cdd0215`](https://github.com/stevekinney/cinder/commit/cdd0215ae3f843c5d0ebf665a3791400ebc904d6) Thanks [@stevekinney](https://github.com/stevekinney)! - Document the distinct ownership boundaries for editor and Cinder diff viewers plus Cinder and Chat message surfaces.

- [#1022](https://github.com/stevekinney/cinder/pull/1022) [`6bd8d76`](https://github.com/stevekinney/cinder/commit/6bd8d76074bf471898a476bde91041a7cc9ca047) Thanks [@stevekinney](https://github.com/stevekinney)! - Use a directional chevron icon for MenuBar submenu indicators.

- [#972](https://github.com/stevekinney/cinder/pull/972) [`7b9be9d`](https://github.com/stevekinney/cinder/commit/7b9be9d9d76024df7af698f96e760c725af2dd9a) Thanks [@stevekinney](https://github.com/stevekinney)! - Strengthen light and dark surface hierarchy, standardize form-control fills, and enforce muted interior dividers with stylelint guardrails.

- Updated dependencies [[`9faa142`](https://github.com/stevekinney/cinder/commit/9faa1422658ceddac3b758e313be3c2d6696bada), [`7ab0910`](https://github.com/stevekinney/cinder/commit/7ab091009749ccaf39b24ce3548b7374c2353e92), [`67f51a7`](https://github.com/stevekinney/cinder/commit/67f51a73a603d04f1858050a60abfed793a0a178), [`899801b`](https://github.com/stevekinney/cinder/commit/899801bdb9192e0b62799c184b74681fbfb72136), [`dca8fbf`](https://github.com/stevekinney/cinder/commit/dca8fbfd7fb5fad5cb429e346e5f13e9af789518), [`92d17da`](https://github.com/stevekinney/cinder/commit/92d17da743f17902a87645cd5c92b8b0ce35e4c4), [`a1f1880`](https://github.com/stevekinney/cinder/commit/a1f1880703e0e0f941b4a348555f009af9630796), [`8ea6973`](https://github.com/stevekinney/cinder/commit/8ea69733a09812ee81ace349d4289e3011ad07b2), [`91eb73c`](https://github.com/stevekinney/cinder/commit/91eb73c6a336e652b7033f75a1c27d051c18a4de), [`cf18ed7`](https://github.com/stevekinney/cinder/commit/cf18ed74fd31ebc90b2a06fa36a7c2588b529e92), [`7f6de70`](https://github.com/stevekinney/cinder/commit/7f6de7056bbfe347aa7b7fe019efaea8bc06c6f0), [`76c3da6`](https://github.com/stevekinney/cinder/commit/76c3da6ccc1356dfa0687129fe1b3bfb40f7a4ce), [`4766190`](https://github.com/stevekinney/cinder/commit/47661907620f26eb61f50b3592c73c013b94e6ea), [`6983b8e`](https://github.com/stevekinney/cinder/commit/6983b8e8c00a05e948ff0f02abe4d50c6c7e0a30), [`c58514f`](https://github.com/stevekinney/cinder/commit/c58514f6c636695e795c93867f508a896ec9aa32), [`5ff29c6`](https://github.com/stevekinney/cinder/commit/5ff29c6acdd8040e09b613f1cb05cccea2713c24), [`c5d2235`](https://github.com/stevekinney/cinder/commit/c5d22353105f1ea52cefc8ad34a1e348342094f7), [`fca6b6a`](https://github.com/stevekinney/cinder/commit/fca6b6a3c9aa212c84f37cf15d63a1962c37eeef), [`761cd8e`](https://github.com/stevekinney/cinder/commit/761cd8e9ea529866a32e0496699917822c20b1c1), [`16671d8`](https://github.com/stevekinney/cinder/commit/16671d86f9b467ddae8f9aee5b36ed1d0d662d84), [`6418308`](https://github.com/stevekinney/cinder/commit/641830824c085af3cb50e24075bbebef75d99f78), [`115705d`](https://github.com/stevekinney/cinder/commit/115705d23092b7663d3045a07327b04b2e77d1fc), [`6bffc7d`](https://github.com/stevekinney/cinder/commit/6bffc7d07e6c7d390a6f111bc85f396201fc36e0), [`abce2be`](https://github.com/stevekinney/cinder/commit/abce2bedbef200211a2aa1f19b8643949cb0291f), [`b22ee52`](https://github.com/stevekinney/cinder/commit/b22ee527c2cab50b2eec851e0b8991316d8a0d21), [`05f9d06`](https://github.com/stevekinney/cinder/commit/05f9d0632018b8ba8c2cdfd5c1ad9bcaa149820c), [`7ec4689`](https://github.com/stevekinney/cinder/commit/7ec46892c9d467f932fe32086a6e47312a48b107), [`1fb92e0`](https://github.com/stevekinney/cinder/commit/1fb92e05faf5660103124a8520aaa31443286746), [`1a9b577`](https://github.com/stevekinney/cinder/commit/1a9b5779c07023ca263d8a34f0365307d00129af), [`e1a27b8`](https://github.com/stevekinney/cinder/commit/e1a27b82c650fc8efe71598227e9afad94cb2188), [`898dcda`](https://github.com/stevekinney/cinder/commit/898dcda4009d7d7c21b51ad35c2c7e549f568fdd), [`cdd0215`](https://github.com/stevekinney/cinder/commit/cdd0215ae3f843c5d0ebf665a3791400ebc904d6), [`76759d3`](https://github.com/stevekinney/cinder/commit/76759d3175b26b664d345e803c7ec5431516aa51), [`81f7b91`](https://github.com/stevekinney/cinder/commit/81f7b91c8c8e80be88a058f47bb3547fd716abd2), [`e113c49`](https://github.com/stevekinney/cinder/commit/e113c49dd2206e1893c0ba970d0f182fbdf0b20c), [`323399a`](https://github.com/stevekinney/cinder/commit/323399ab5e8bbbb7f2118d5163bb607db71340b8), [`6130fbb`](https://github.com/stevekinney/cinder/commit/6130fbbb97181e26df63e080a070567f5d964c8b), [`b12595e`](https://github.com/stevekinney/cinder/commit/b12595e2a16db3d497fcbb5a831db95a9ac84187), [`a1b532b`](https://github.com/stevekinney/cinder/commit/a1b532b827a6304c249eb32e3d1b226d31c2b602), [`5ff75da`](https://github.com/stevekinney/cinder/commit/5ff75da61a812351849333db0f51abef4ac71896), [`b26c1b4`](https://github.com/stevekinney/cinder/commit/b26c1b4089030a0b995fe66339df376634af5c7a), [`490098c`](https://github.com/stevekinney/cinder/commit/490098c0d8647bae9e51177ac6e1017456ec73a2), [`74a58e6`](https://github.com/stevekinney/cinder/commit/74a58e6cc68f7b5db632090f80e0f81a7d62c66b), [`5bf2b09`](https://github.com/stevekinney/cinder/commit/5bf2b09d59b62dc7cd61b01aafd076c5133977ca), [`dc90b46`](https://github.com/stevekinney/cinder/commit/dc90b4675e59f263ea6ee402e5375ec01fa9620b), [`4a279a2`](https://github.com/stevekinney/cinder/commit/4a279a28b9423559e6e33fe5123696a275ea2006), [`b12595e`](https://github.com/stevekinney/cinder/commit/b12595e2a16db3d497fcbb5a831db95a9ac84187), [`44e11a5`](https://github.com/stevekinney/cinder/commit/44e11a52cd1b1169dc2dd075964114aa32f318d4), [`2b92897`](https://github.com/stevekinney/cinder/commit/2b92897a03395096d185d6545435fb2554bbd0f7), [`d4a63dc`](https://github.com/stevekinney/cinder/commit/d4a63dcf0d40d9f6dae52962a8a30e6893c1675d), [`06d7002`](https://github.com/stevekinney/cinder/commit/06d7002e9a0356dd922eb236772e06789a978b6f), [`b33f757`](https://github.com/stevekinney/cinder/commit/b33f7575e87f1226f603f2e122fae3942a3d349f), [`6166a73`](https://github.com/stevekinney/cinder/commit/6166a73d90e71745d4357a2a0d3a536d327b10a7), [`e81880b`](https://github.com/stevekinney/cinder/commit/e81880b47717b07fb83830faee4ee91204d16727), [`876c600`](https://github.com/stevekinney/cinder/commit/876c60083dc674b648f47c99aeff59d62e15b4aa), [`6bd8d76`](https://github.com/stevekinney/cinder/commit/6bd8d76074bf471898a476bde91041a7cc9ca047), [`41fdd11`](https://github.com/stevekinney/cinder/commit/41fdd11644884db69b7cffe8ee9bf1b1921d8974), [`40bd219`](https://github.com/stevekinney/cinder/commit/40bd219c80a4411f81d82a2105f477c1554a45dd), [`412f275`](https://github.com/stevekinney/cinder/commit/412f27521e7f339c5e62649c3980eeb355f38cd7), [`f5d2ec6`](https://github.com/stevekinney/cinder/commit/f5d2ec62a878282f9faa10c9c3d67819b77f7213), [`a96c5c0`](https://github.com/stevekinney/cinder/commit/a96c5c09fd5ef025d79d97006bd6ea0b71a78db3), [`462b85b`](https://github.com/stevekinney/cinder/commit/462b85b8cad5859bbcd97c86428fc10d839aa255), [`a39d748`](https://github.com/stevekinney/cinder/commit/a39d74892a06cae40f13aa663f0d250598cc094b), [`2dc6c75`](https://github.com/stevekinney/cinder/commit/2dc6c75fcbb74a87d8fc179ca4f16c24b93055f6), [`2dc6c75`](https://github.com/stevekinney/cinder/commit/2dc6c75fcbb74a87d8fc179ca4f16c24b93055f6), [`2dc6c75`](https://github.com/stevekinney/cinder/commit/2dc6c75fcbb74a87d8fc179ca4f16c24b93055f6), [`2dc6c75`](https://github.com/stevekinney/cinder/commit/2dc6c75fcbb74a87d8fc179ca4f16c24b93055f6), [`2dc6c75`](https://github.com/stevekinney/cinder/commit/2dc6c75fcbb74a87d8fc179ca4f16c24b93055f6), [`2dc6c75`](https://github.com/stevekinney/cinder/commit/2dc6c75fcbb74a87d8fc179ca4f16c24b93055f6), [`2dc6c75`](https://github.com/stevekinney/cinder/commit/2dc6c75fcbb74a87d8fc179ca4f16c24b93055f6), [`2dc6c75`](https://github.com/stevekinney/cinder/commit/2dc6c75fcbb74a87d8fc179ca4f16c24b93055f6), [`7d069b6`](https://github.com/stevekinney/cinder/commit/7d069b6cac6287737fa7623c8e8b3e99249e1ea8), [`dbcc986`](https://github.com/stevekinney/cinder/commit/dbcc986919d2bddb3dd4e3bda0c2089699595dfc), [`925a0fc`](https://github.com/stevekinney/cinder/commit/925a0fc905c80ec6663f22d908d31ad7d3fdbe9a), [`3897000`](https://github.com/stevekinney/cinder/commit/389700023af97651b11ff4bf1d21962a935a76ba), [`034413c`](https://github.com/stevekinney/cinder/commit/034413cf9591d1c31ad439349cab6d0bbed6df5a), [`7f924e1`](https://github.com/stevekinney/cinder/commit/7f924e1c3f4eca10530606d14bf6c8778f998455), [`d99561f`](https://github.com/stevekinney/cinder/commit/d99561fe37c49ef4791109e220d242cde11b67db), [`e7e92ad`](https://github.com/stevekinney/cinder/commit/e7e92ad8d59b11864bb10a5f915afc5ddacfc192), [`42262d1`](https://github.com/stevekinney/cinder/commit/42262d1f7378ce6c85dc4ac60123991fee0004a1), [`4c6455c`](https://github.com/stevekinney/cinder/commit/4c6455c84e97cce49a2e2defd8f823e2903e8a0f), [`f621c7e`](https://github.com/stevekinney/cinder/commit/f621c7e0fd98dd76982575c5e55ae901018bcb55), [`277503a`](https://github.com/stevekinney/cinder/commit/277503a78d7b3cdad23a6b3b10ad4b7ea4a1415d), [`3b3685f`](https://github.com/stevekinney/cinder/commit/3b3685f63ca518a6006a5212c78c837b2e4ba91f), [`fad8c3f`](https://github.com/stevekinney/cinder/commit/fad8c3f7a5a618534c71b413a82db7d88f290c0f), [`928ce6a`](https://github.com/stevekinney/cinder/commit/928ce6a3e26a0a101f1cb7a8b6a94d6708a88ab9), [`057b1ee`](https://github.com/stevekinney/cinder/commit/057b1ee1d0a1f82eed05e682565fc8d7d6f9745a), [`cfc7fa8`](https://github.com/stevekinney/cinder/commit/cfc7fa80cfa2e21150830c7f66d68b78da37f99e), [`09ab845`](https://github.com/stevekinney/cinder/commit/09ab8459df15bcdbddec2737e0f98bafb1c2f796), [`4aa510d`](https://github.com/stevekinney/cinder/commit/4aa510d7a59382a53c1344ba79df43313b91fde9), [`4fe3131`](https://github.com/stevekinney/cinder/commit/4fe313159e6ee88d13ec6a10a15acb5347c00bbe), [`a73801c`](https://github.com/stevekinney/cinder/commit/a73801c4ffc5d651e358b9e36fea9fb51dcf3059), [`f59f9f9`](https://github.com/stevekinney/cinder/commit/f59f9f93ce3f209a20e46ebb1891b5ebeeec757e), [`1f6f63e`](https://github.com/stevekinney/cinder/commit/1f6f63e78b1f23a6000d8ffba790976804f43b49), [`cb2e132`](https://github.com/stevekinney/cinder/commit/cb2e13237a014058a5adbad8a6ff1768040f25a1), [`7b9be9d`](https://github.com/stevekinney/cinder/commit/7b9be9d9d76024df7af698f96e760c725af2dd9a), [`912c785`](https://github.com/stevekinney/cinder/commit/912c785c93286da98c93f58e38e7e13ae5614292), [`74a58e6`](https://github.com/stevekinney/cinder/commit/74a58e6cc68f7b5db632090f80e0f81a7d62c66b), [`0a43737`](https://github.com/stevekinney/cinder/commit/0a43737b4cc04a8d13628fbb47879fb5f5ba117b), [`5b640a3`](https://github.com/stevekinney/cinder/commit/5b640a3b043c33667a243c526c79ddd72e6912a2), [`dc3dc20`](https://github.com/stevekinney/cinder/commit/dc3dc20153e59b03cceb5c0d6c505111af44f4e9), [`c5bd054`](https://github.com/stevekinney/cinder/commit/c5bd05414313548118fe9c8aa5eab645ba1ec6dd), [`43eb35b`](https://github.com/stevekinney/cinder/commit/43eb35bb96c50cefdeb61c121a540eec5049fc9f)]:
  - @lostgradient/cinder@0.20.0

## 0.1.0

### Minor Changes

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

### Patch Changes

- Updated dependencies [[`ffbbb2f`](https://github.com/stevekinney/cinder/commit/ffbbb2f3b6fc9ac8bbb14c598716e49cff72c517), [`fdecd5e`](https://github.com/stevekinney/cinder/commit/fdecd5e63a0ea2e3ca8e3d997efa3f815d1bd664), [`955adb0`](https://github.com/stevekinney/cinder/commit/955adb0459272b9d08ed8a5eb13b579ce83997a7), [`30feaa5`](https://github.com/stevekinney/cinder/commit/30feaa509548f436e77c47520d9b49193f76c6f4), [`f86e857`](https://github.com/stevekinney/cinder/commit/f86e8577f03cedad95858f5fb60a20f3265a2407), [`204928e`](https://github.com/stevekinney/cinder/commit/204928e8b07e6e1e7ea7f16c994ae3e201933bf9), [`62a9a75`](https://github.com/stevekinney/cinder/commit/62a9a75c321303f7f4c8cd8d429fc0d1a071f667), [`0ef0a27`](https://github.com/stevekinney/cinder/commit/0ef0a272568e716e0dac034e60347f5cf3f611d6), [`caa5b36`](https://github.com/stevekinney/cinder/commit/caa5b36ea46511a8e62f514d89e2f4a5726f9fc9), [`23a5ebc`](https://github.com/stevekinney/cinder/commit/23a5ebc161be56d1198829fb269372e67f85d5bb), [`35732d8`](https://github.com/stevekinney/cinder/commit/35732d8d15240082ccb5d7b4be6d6216a05c40ea), [`d7ecfc4`](https://github.com/stevekinney/cinder/commit/d7ecfc4cece464edddef9e027ae5176d40313766), [`fffa0ab`](https://github.com/stevekinney/cinder/commit/fffa0abf2ee41c9cf0a0e100eb5ee99447f5d5f4), [`e9c1146`](https://github.com/stevekinney/cinder/commit/e9c11464ca1ef5af0801439270f4e0e09411ad41), [`006641e`](https://github.com/stevekinney/cinder/commit/006641ebfd998a78e0c2d0459b503c750f9a014c), [`1b80249`](https://github.com/stevekinney/cinder/commit/1b802498e71f799ceac44becd67fec73f8b7d74c), [`4376c18`](https://github.com/stevekinney/cinder/commit/4376c18e2f0dd055ec629cd02035447f8f6e13b2), [`2174be0`](https://github.com/stevekinney/cinder/commit/2174be0182d834d8aa3f1dbe82a2b3fe54b153db), [`280ba3e`](https://github.com/stevekinney/cinder/commit/280ba3e9eed6e76d7534bd0f4f78ff8890cf05df), [`7e9d2f6`](https://github.com/stevekinney/cinder/commit/7e9d2f65b1b464762f6858a0e6429c1c6c52d4d1), [`356c5d7`](https://github.com/stevekinney/cinder/commit/356c5d7f7a4d3a7e9306b71e6039ce05382c7aa7), [`282b380`](https://github.com/stevekinney/cinder/commit/282b38060b765340a58f07487c53a0f9710d4033), [`31fd201`](https://github.com/stevekinney/cinder/commit/31fd20103079bc6cebeadab8c0e11390119754f3), [`88d8b17`](https://github.com/stevekinney/cinder/commit/88d8b17d99e74742d0819094b3c6a5740079d6c3), [`09bdd26`](https://github.com/stevekinney/cinder/commit/09bdd2627ef2a36edf502add662ffd08a9b6ae41)]:
  - @lostgradient/cinder@0.17.0
  - @lostgradient/markdown@0.1.0
