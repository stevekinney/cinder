# InlineConfirm accessibility review

Nearest neighbour: `ConfirmDialog`. This component intentionally remains in flow: it has no modal semantics, scrim, scroll lock, focus trap, or `aria-modal`. The prompt labels the action group, both buttons are keyboard reachable, Escape follows the shared LIFO stack, and focus returns to the opener. Destructive actions use the danger button variant.
