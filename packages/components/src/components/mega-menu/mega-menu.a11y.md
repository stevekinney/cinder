# MegaMenu accessibility notes

- Uses native `<nav>` semantics with explicit `aria-label`.
- Top-level triggers expose `aria-expanded` and `aria-controls`.
- Top-level keyboard support:
  - `ArrowLeft` / `ArrowRight` for top-level trigger traversal
  - `Home` / `End` jump to first/last trigger
  - `ArrowDown` / `Enter` / `Space` opens the current menu and moves focus into content
  - `Escape` closes open content and returns focus to trigger
- Hover mode (`openOnHover`) is optional; click and keyboard remain supported in all modes.
- Active content container uses `role="group"` with a labelled relationship to the open trigger.

## Nested submenu (master/detail) review

Reviewed for the two-axis nested model added alongside the master/detail layout:
a column of submenu triggers on one axis, and a detail panel on the other.

- Structure: submenu triggers get stable `aria-controls`/`aria-expanded` IDs
  (`submenuTriggerId`/`submenuPanelId`) tied to their detail panel, and the
  detail panel is `aria-labelledby` the active trigger — mirroring the
  top-level trigger/panel relationship rather than inventing a new pattern.
- Focus management: entering a submenu panel moves focus to its first
  focusable descendant (falling back to the panel itself when empty);
  returning from the panel restores focus to the controlling trigger, never
  to the top-level trigger or document body.
- Keyboard matrix (submenu trigger column):
  - `ArrowDown` / `ArrowUp` traverse triggers, wrapping at the ends
  - `Home` / `End` jump to first/last trigger
  - direction-aware "enter" arrow (`ArrowRight` in LTR, `ArrowLeft` in RTL) or
    `Enter` / `Space` opens the detail panel and moves focus into it
  - direction-aware "return" arrow (`ArrowLeft` in LTR, `ArrowRight` in RTL)
    from either the trigger column or an open detail panel returns focus to
    the top-level trigger
  - `Escape` from the trigger column or detail panel closes the whole menu
    and restores focus to the top-level trigger
  - Modified arrow keys (Alt/Ctrl/Meta) and modified Home/End are left
    unhandled so browser/OS shortcuts using those chords are not shadowed.
- Direction awareness: `resolvedDirection` (see `_internal/text-direction.ts`)
  drives which physical arrow key means "enter" vs "return" so the keyboard
  path always matches the rendered layout in both LTR and RTL.
- Assistive-technology announcements: no live region is introduced for the
  nested panel; the existing `aria-expanded`/`aria-controls` relationship on
  the trigger and the panel's `aria-labelledby` are sufficient for screen
  readers to announce the state change on activation, consistent with the
  top-level menu's existing pattern.
- Regression coverage: `mega-menu.test.ts` (unit) and
  `mega-menu.playwright.ts` (real Chromium keyboard traversal) exercise this
  matrix, including the RTL direction swap.
