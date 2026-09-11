---
'@lostgradient/cinder': patch
---

Close the runtime coverage ratchet's remaining gap and wire it into CI (unit-tests.yaml and main-green.yaml now run `test:coverage` for this package alongside Chat's). No public API changes: a few internal functions (`composedFocusScopes`, the shadow-slot walk in `collectComposedElements`, `waitForTransitionCompletion`'s cancel-listener attachment, `splitScopeOutsideContext`) were restructured in behavior-preserving ways to eliminate lines Bun's coverage instrumentation could never attribute a hit to even when the branch executes, and the internal `chart-utilities.ts` barrel now also re-exports `createHorizontalCategoryLabelLayout` alongside the chart helpers it already exposed.
