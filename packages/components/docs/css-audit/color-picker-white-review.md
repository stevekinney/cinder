# Color-picker `#fff` semantic review (Batch G)

Classification of the three remaining `background-color: #fff` sites in the
color-picker and color-swatch-picker components. Each site was reviewed against
its surrounding rule to determine whether the white represents UI chrome, a
literal color value, or a transparency-checkerboard backing.

| file:line                                                                           | role                   | decision                 | justification                                                                                                                                                                                                     |
| ----------------------------------------------------------------------------------- | ---------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/components/src/components/color-picker/color-picker.css:89`               | `transparency-checker` | `keep #fff with comment` | This is the alpha slider track; the `#ccc` diagonal gradients above it form the transparency checkerboard, and the `#fff` is the literal white square half of that checker — not a theme surface.                 |
| `packages/components/src/components/color-picker/color-picker.css:143`              | `transparency-checker` | `keep #fff with comment` | This is the preview swatch in alpha mode; the layered `#ccc`/transparent gradients render the checkerboard pattern over a literal white backing so transparent colors render correctly against a fixed reference. |
| `packages/components/src/components/color-swatch-picker/color-swatch-picker.css:71` | `transparency-checker` | `keep #fff with comment` | Same checkerboard pattern applied to individual alpha swatches; the `#fff` is the white square of the checker, intentionally invariant to theme so the alpha visualization is consistent.                         |

## Deferred token

A new `--cinder-color-checker-bg` token (paired with the existing `#ccc`
checker squares, which would presumably become `--cinder-color-checker-fg`)
would be a cleaner long-term home for these literals. That introduction is
gated on explicit design sign-off and is **not** part of Batch G. For now the
sites are annotated with intent comments so reviewers do not mistake them for
unthemed chrome.
