---
'@lostgradient/cinder': minor
---

Add a `format?: 'hex' | 'rgb' | 'hsl' | 'hwb' | 'oklch'` prop to `ColorField` and `ColorPicker` (default `'hex'`) that controls the emitted string's CSS Color 4 syntax; `value` stays a plain string. Alpha policy: hex emits `#rrggbbaa` only when alpha is below 1 (plain `#rrggbb` otherwise), and every other format uses modern space-separated syntax with slash alpha (`oklch(l c h / a)`), omitting the `/ a` segment when alpha is exactly 1. Out-of-sRGB values are gamut-mapped via CSS Color 4 chroma reduction, powered by the new `culori` dependency. `ColorField`'s existing `formats` (input parsing) prop gains `'oklch'` as an accepted input syntax, independent of `format`.
