---
'@lostgradient/cinder': minor
---

Add a `format?: 'hex' | 'rgb' | 'hsl' | 'hwb' | 'oklch'` prop to `ColorField` and `ColorPicker` (default `'hex'`) that controls the emitted string's CSS Color 4 syntax; `value` stays a plain string. Alpha policy: hex emits `#rrggbbaa` only when alpha is below 1 (plain `#rrggbb` otherwise), and every other format uses modern space-separated syntax with slash alpha (`oklch(l c h / a)`), omitting the `/ a` segment when alpha is exactly 1. Out-of-sRGB values are gamut-mapped via CSS Color 4 chroma reduction, powered by the new `culori` dependency. `ColorField`'s existing `formats` (input parsing) prop gains `'oklch'` as an accepted input syntax. `formats` and `format` are independent, but not mutually exclusive: the configured `format` is always an implicitly accepted input syntax too, regardless of what `formats` lists, so e.g. `formats={['hex']}` combined with `format="rgb"` still accepts user-entered `rgb()` values.
