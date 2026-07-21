---
'@lostgradient/cinder': patch
---

Thinned `pre-push` to a fast, fail-open sanity check (no more local lint/typecheck/test dispatch or gate lock) now that PR CI and required branch-protection status checks own that validation. No published runtime behavior changes — this only touches internal `scripts/husky/*` tooling and `check-pipeline-coverage.ts`'s declaration table.
