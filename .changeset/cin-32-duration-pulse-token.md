---
'@lostgradient/cinder': minor
---

Add `--cinder-duration-pulse`, a public duration token for the breathing opacity loop shared by status indicators and skeleton placeholders.

`StatusDot`, `ConnectionIndicator`, and `Feed` previously hard-coded `1.4s` for their pulse animations. All three now use the token, so the animation collapses to `0ms` under `prefers-reduced-motion` and `data-reduced-motion='on'` like every other duration token — behavior those three components did not have before, since a literal duration cannot be overridden by a motion context.

The value is numerically equal to `--cinder-duration-progress-ring-spin` today, but the two are deliberately separate tokens: a pulse and a spinner are unrelated motions and either may be retuned without the other.

This also moves Cinder's token guardrails onto the DTCG corpus rather than parsing generated CSS. The literal-bypass guard now derives the values it flags from the `duration` and `fontWeight` tokens the corpus declares, so retuning a token re-points the guard automatically; it previously checked for values no token had carried since an earlier retune. No other token value changed.
