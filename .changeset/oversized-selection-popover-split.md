---
'@lostgradient/cinder': patch
---

Internal restructuring: extract SelectionPopover's virtual-keyboard-dismissal heuristic into `createVirtualKeyboardDismissal`, a factory that owns its own `$effect`. No behavior or public API change; adds unit test coverage for logic that was previously only reachable through a full popover mount plus real `visualViewport`/`navigator.virtualKeyboard` events.
