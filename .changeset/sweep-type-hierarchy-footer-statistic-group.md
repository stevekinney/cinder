---
'@lostgradient/cinder': patch
---

Sharpen type hierarchy and spacing across CapabilityGate, Footer, and StatisticGroup.

CapabilityGate's body content gains an explicit `font-weight`, so all three of its text
elements differ from one another on at least two of size, weight, and colour. Previously the
content and status-value tiers were separated by colour alone.

Footer's outer gap moves from `--cinder-space-6` to `--cinder-space-8`. The same token had
been spent on two different relationships — brand-to-groups (related) and main-to-legal
(unrelated) — so the legal row read as a peer of the link groups. Spacing is now strictly
increasing with nesting depth.

StatisticGroup's `default` variant gains a resting border and per-cell dividers, so it reads
as a deliberate treatment rather than an unstyled fallback next to the `cards` and
`shared-borders` variants. Its sizing tokens are unchanged.
