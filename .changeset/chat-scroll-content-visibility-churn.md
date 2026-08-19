---
'@lostgradient/chat': patch
---

Fix `atBottom` sometimes settling wrong after `scrollToTop()`/`scrollToBottom()` when off-screen `.chat-message` rows use `content-visibility: auto` row virtualization and the animation runs long enough for rows to churn mid-flight (rows scrolled past re-collapse to their `contain-intrinsic-size` estimate, newly-visible rows expand to real height, shifting `scrollHeight` by hundreds of px while the scroll is in progress).

Two asymmetries let that churn leave `atBottom` wrong at settlement: `scrollToBottom()` never went through `withUserScrollGuard`, so it had no `scrollend`-driven final geometry recompute — only the passive, rAF-batched `scroll` listener, which can lag or coalesce under load and never fire again after the last geometry change (this was ~80% of the observed failures). `scrollToTop()` did go through the guard but never forced layout for the animation's duration, so a `scrollend` arriving while bottom rows were transiently collapsed could read `scrollHeight <= clientHeight` — indistinguishable from a genuinely short transcript — and settle with `atBottom` stuck `true`.

`scrollToBottom()` now routes through `withUserScrollGuard` (getting the same final recompute `scrollToTop`/`jumpToLatest` already had), and `scrollToTop()` now forces layout for its animation's duration (the same treatment `scrollToBottom`/`jumpToLatest` already had), so both paths hold rows at real height until they settle instead of racing content-visibility's collapse/expand churn.

Reproduced deterministically in `use-chat-scroll-state.test.ts` by driving the hook's public API against a fake viewport whose `scrollHeight` getter models the churn (collapsed unless `data-cinder-force-visible` is set), rather than relying on a CI-timing-dependent real-browser repro — this is a layout-timing race that a real WebKit run only reproduced in ~20% of runs even under CI CPU pressure (0% locally), which is exactly the kind of flake a synthetic harness driving the actual code path under test can pin deterministically.
