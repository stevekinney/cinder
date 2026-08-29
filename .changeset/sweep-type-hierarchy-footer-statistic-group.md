---
'@lostgradient/cinder': patch
---

Sharpen type hierarchy and spacing across Footer and StatisticGroup.

Footer's outer gap moves from `--cinder-space-6` to `--cinder-space-8`. The same token had
been spent on two different relationships — brand-to-groups (related) and main-to-legal
(unrelated) — so the legal row read as a peer of the link groups. Spacing is now strictly
increasing with nesting depth. When a consumer supplies only `copyright` or `legalLinks`,
the now-empty main region no longer contributes that outer gap.

StatisticGroup's `default` variant gains a resting border and per-cell dividers, so it reads
as a deliberate treatment rather than an unstyled fallback next to the `cards` and
`shared-borders` variants.

Dividers apply to fixed `columns` counts only. `columns='1'` gets horizontal dividers,
`columns={2|3|4}` get vertical ones with each row's last cell suppressed, and
`columns='auto'` — the default — gets none: `repeat(auto-fit, …)` has no upper bound on its
track count, so CSS cannot identify which cells end a row. An auto group therefore keeps the
variant's border, inset surface, and gap without cell dividers. Its sizing tokens are
unchanged.
