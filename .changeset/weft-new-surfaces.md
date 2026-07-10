---
'@lostgradient/cinder': minor
---

Add four additive surfaces for coordination and scheduling UIs:

- **RunStepTimeline** gains branch/coordination groups — a `kind: 'branch'` entry with parallel sub-lanes (`won` / `lost` / `settled` outcomes, winner emphasized, losers muted, collapsible), a per-step `rewound` flag for speculatively-executed-then-unwound steps, and a per-step `compensates` linkage that renders a compensating step inset beneath its forward step with a reversal affordance. Existing `RunStep[]` timelines render unchanged.
- **ConnectionIndicator** (new) — a standalone live-connection status pill with `connecting` / `live` / `reconnecting` / `polling` / `stale` / `closed` states. `live` pulses (static under reduced motion), `reconnecting` exposes an attempt-count slot, and `polling` reads distinctly quieter than `live`. Status is conveyed by icon + text (never color alone) with a `status` role, and reuses StatusDot's semantic tokens so it composes cleanly beside EventStreamViewer.
- **ScheduleBuilder** (new) — a date-library-free recurrence control with Presets / Cron / Interval modes behind a SegmentedControl, an always-visible plain-English summary, a "next N fires" preview (computed via an injected `computeNextFires` callback, hidden when absent), and a timezone slot. Emits a discriminated `{ mode: 'cron' | 'interval', ... }` value; presets lower losslessly to one of those two.
- **InvocationRuleBuilder** gains a conditions-only mode: rules carry conditions with no action target, operators constrained to `eq` / `gt` / `lt` / `gte` / `lte`, and typed value inputs inferred from field type. The existing conditions-plus-actions mode is unchanged and remains the default.
