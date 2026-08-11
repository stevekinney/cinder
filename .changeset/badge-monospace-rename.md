---
'@lostgradient/cinder': minor
---

feat(badge)!: rename `monochrome` to `monospace` (#1251)

BREAKING: Badge's `monochrome` prop is renamed to `monospace`, and the
`data-cinder-monochrome` attribute (CSS/test hook) to
`data-cinder-monospace`. No compatibility alias — cinder is pre-release.

The prop has always rendered the badge label in a monospace font (version
strings, error codes, commit SHAs); the `monochrome` name came from the
0.22 no-abbreviations sweep expanding the old `mono` to the wrong full
word — "monochrome" is color vocabulary, not typeface vocabulary.
`check:prop-conventions` now bans both `mono` and `monochrome` with
pointed messages, so a stale name fails the gate instead of silently
type-erroring. Internal consumers (RunStepTimeline's attempt badges,
ApprovalCard's environment badge) are migrated.

Also repaired in the same sweep-audit: comments and an identifier mangled
by the original blanket replace (`monorepoRoot` had become
`monochromerepoRoot` in `run-consumer-fixture.ts`, "monorepo root" had
become "monochromerepo root" in a toast-region test comment, and the
playground's `dx-spec__val--mono` class had become `--monochrome` while
still applying `--cinder-font-mono`).
