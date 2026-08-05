---
'@lostgradient/cinder': patch
---

Resolve additional `@container` and `@scope` text-direction spec-parity gaps:

- Evaluate comma-separated `@container` condition lists (`CSSContainerRule.conditions`) as independent name+query entries, OR'd together, instead of failing closed on the blanked legacy `containerName`/`containerQuery` accessors.
- Resolve relative (non-exact) `:scope` scope-start selectors (`@scope (:scope > .child)`) against the enclosing scope's root(s) instead of failing closed.
- Preserve the supported exact `:scope` alternative in a mixed all-`:scope` root list (`@scope (:scope, :scope > .theme)`) even when a sibling relative alternative can't resolve.
- Resolve outside-ancestor context in scoped rule selectors (`main :scope .shell`) against the scope root's real ancestor chain instead of losing it to the detached-clone fallback's isolated subtree.
- Normalize each item of a rule selector list independently for leading-combinator shorthand (`.unused, > .shell`), instead of gating on whether the whole list starts with a combinator.
