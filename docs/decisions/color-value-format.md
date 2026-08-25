# Color value format for ColorField and ColorPicker

**Status:** Accepted 2026-08-24.

Question: do `ColorField` and `ColorPicker` keep hex-only output, or move to
format-tagged values?

Decision: `value` stays a plain string. Both components gain an additive
`format?: 'hex' | 'rgb' | 'hsl' | 'hwb' | 'oklch'` prop (default `'hex'`) that
selects the emitted string's CSS Color 4 syntax. `lab` is deliberately
excluded — it has no compelling consumer use case over `oklch` for this
surface. A tagged-object `value` was rejected: it would break the bindable
`value` contract and every existing form-mirror round-trip that assumes a
plain string.

`format` is output-only and independent of ColorField's pre-existing
`formats` (plural) prop, which continues to gate the _input_ syntaxes the
field will parse. `formats` gained `'oklch'` as an accepted input value so a
consumer can opt into accepting `oklch()` strings without changing what the
field emits.

The configured `format` is always an implicitly accepted input format too,
regardless of what `formats` lists: the field must be able to parse back the
exact syntax it just emitted, or the emit/re-parse round trip breaks. So
`formats={['hex']}` combined with `format="rgb"` still accepts user-entered
`rgb()` values — `formats` narrows what else is accepted, it never excludes
the configured output format's own syntax. Don't rely on `formats` to reject
`format`'s syntax.

Alpha policy: whether the emitted alpha suffix appears is decided by each
format's own opacity-quantization threshold, not literally "alpha equals
1" — every format treats alpha as opaque slightly before the mathematical
boundary, because each canonicalizes alpha to its own emitted precision
before deciding whether to keep the suffix, exactly the way `formatHex`
already canonicalizes a byte-rounds-to-`0xff` alpha to plain `#rrggbb`
rather than emit a byte-for-byte-opaque `#rrggbbff`:

- `hex` quantizes alpha to a single byte (0-255): it emits `#rrggbbaa`
  only when the alpha BYTE (`Math.round(alpha * 255)`) is below 255, and
  plain `#rrggbb` once that byte reaches 255 — which happens for any alpha
  `>= ~0.998` (e.g. `0.999`), not only alpha `=== 1`.
- Every other format uses modern space-separated CSS Color 4 syntax with
  slash alpha (`oklch(l c h / a)`, `rgb(r g b / a)`, etc.), omitting the
  `/ a` segment once alpha rounds to `1` at 4 decimal places (`canonicalAlpha`
  in `color-format.ts`) — which happens for any alpha `>= 0.99995` (e.g.
  `0.99999`), not only alpha `=== 1`. Alpha is never silently dropped BELOW
  each format's own threshold — only quantized to opaque at or above it,
  the same way byte/decimal precision limits round any other channel.
- Every alpha-dependent surface (the emitted `value`, ColorPicker's preview,
  its checkerboard backdrop, and its RGB/HSL copy-panel strings) must ask
  the SAME format-appropriate threshold (`isOpaqueForFormat` in
  `color-format.ts`) — never a fixed boundary independent of `format` —
  or two representations of the identical color can disagree about whether
  it's translucent.
- `ColorPicker.alpha` remains a UI-affordance concern (whether the alpha
  slider renders) uniformly across every format — it is not a hex-only
  special case, and it is independent of the quantization threshold above:
  disabling the slider does not change where a format's opacity boundary
  sits, it only gates whether an interactive commit can produce alpha `< 1`
  in the first place.

Gamut policy: out-of-sRGB values (reachable today by parsing an `oklch()`
input string directly) are mapped into sRGB via CSS Color 4 chroma reduction,
implemented with `culori`'s `toGamut` utility — never a hand-rolled chroma
clamp. Hue is preserved by construction, since the chroma-reduction bisection
never touches hue.

Round-trip stability: parsing a value and re-emitting it in the same format
is idempotent for all five formats.

Implementation: `packages/components/src/utilities/color-format.ts` is the
shared conversion/formatting module both components use, backed by `culori`
(added as a `@lostgradient/cinder` dependency for parsing, conversion, and
gamut mapping).
