---
'@lostgradient/cinder': minor
---

Add semi-transparent inline ghost-text completion to CommandMenu, gated behind a new opt-in `onComplete` prop, with a fully specified keyboard model (ArrowRight/Tab accept, Enter always wins for listbox selection, Escape dismisses ghost text before closing) recorded in `command-menu.a11y.md`. `caretIndex` is now optional, deriving from the anchor's live selection when omitted.
