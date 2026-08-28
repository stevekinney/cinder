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
`shared-borders` variants. Divider direction follows the effective column count rather than a
standalone breakpoint: single-column layouts get horizontal dividers, multi-column layouts
vertical ones, and each row's last cell no longer draws a divider off the grid's trailing
edge. Its sizing tokens are unchanged.
