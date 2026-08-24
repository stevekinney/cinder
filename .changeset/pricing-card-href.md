---
'@lostgradient/cinder': minor
---

Add an optional `href` prop to `PricingCard` (plus `target`/`rel` scoped to the CTA anchor). When `href` is set, the CTA renders as an anchor instead of a button, following the same per-item action-swap pattern as `Steps`. `onPlanSelect` becomes optional when `href` is set, but is not mutually exclusive with it — pass both to navigate and still run a side effect such as analytics tracking.
