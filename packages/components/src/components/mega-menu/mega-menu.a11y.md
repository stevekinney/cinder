# MegaMenu accessibility notes

- Uses native `<nav>` semantics with explicit `aria-label`.
- Top-level triggers expose `aria-expanded` and `aria-controls`.
- Keyboard support:
  - `ArrowLeft` / `ArrowRight` for top-level trigger traversal
  - `Home` / `End` jump to first/last trigger
  - `ArrowDown` opens current menu and moves focus into content
  - `Escape` closes open content and returns focus to trigger
- Hover mode (`openOnHover`) is optional; click and keyboard remain supported in all modes.
- Active content container uses `role="group"` with a labelled relationship to the open trigger.
