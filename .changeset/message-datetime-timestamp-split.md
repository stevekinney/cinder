---
'@lostgradient/cinder': major
---

Breaking: `Message` replaces the single `time` prop with `datetime` and `timestamp`.

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
