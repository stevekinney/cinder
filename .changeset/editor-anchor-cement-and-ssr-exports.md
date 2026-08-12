---
'@lostgradient/editor': patch
---

Stop a mis-seeded anchor from being cemented at the wrong text, warn about one in
dev, and prefer Svelte source exports during SvelteKit SSR.

**A seeded anchor whose range overlapped its own quote was adopted, not corrected**
(#1275). Flagging an anchor for re-anchoring only schedules work 300ms out, and
Milkdown's `syncHeadingIdPlugin` stamps `id` attributes onto every heading inside
that window. Its step spans the whole heading, so `didTransactionAffectAnchorRange`
was true and the "follow the edit" branch overwrote the anchor's `quote` with
whatever text sat at the bad range. The anchor then looked internally consistent,
the deferred pass skipped it, and `{from: 2, to: 14}` for `Release Plan` rendered
`elease Plan` permanently — while the identical mistake in a paragraph, which that
transaction does not touch, repaired correctly. That branch is now gated on the
anchor having verifiably described its own text before the transaction.

**Nothing told a consumer their coordinates were wrong.** A dev-only warning now
fires the first time the plugin sees a thread whose range does not describe its
quote, naming the three coordinate spaces involved. It is scoped to threads the
plugin has not tracked before, which keeps it off ordinary editing drift.

**ReviewEditor emitted a `hydration_mismatch` on every SSR load** (#1277). The
package listed `node` before `svelte` in the conditional exports for
`./markdown-editor`, `./review-editor` and `./diff-viewer`. Conditional exports
resolve to the first matching key and SvelteKit SSR activates both, so the server
loaded the precompiled `dist/server` bundle while the browser compiled the same
components from source — two independent compilations of one page, disagreeing on
hydration anchor comments. This is the same defect fixed for `@lostgradient/chat`
and `@lostgradient/cinder`; editor was missed by that sweep. The order is corrected
in the source manifest and in `pack-for-publish`, and pinned by an invariant over
every conditional export rather than a per-subpath list.
