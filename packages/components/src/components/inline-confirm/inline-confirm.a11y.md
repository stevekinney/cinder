# InlineConfirm design and accessibility review

## Design review (required)

- Reviewer: Cinder maintainers
- Review outcome: Approved for implementation review.
- Nearest neighbours: ConfirmDialog, Alert, ButtonGroup.
- Why this component exists: It keeps a short, reversible confirmation beside the action without interrupting the page with a top-layer dialog.
- Findings and resolutions: It uses document flow and existing Button primitives. It intentionally has no scrim, `aria-modal`, focus trap, body scroll lock, or modal backdrop. The destructive variant changes the confirm button only; prompt and action labels remain visible text.

## Novel interaction accessibility review

- Applies: Yes—the component introduces an interactive group and participates in the shared Escape stack.
- Reviewer: Cinder maintainers
- Review outcome: Approved for implementation review.

### Focus management

The visible prompt labels `role="group"`. On open, focus moves to Cancel, the safe action. On cancel, confirm, or Escape, focus returns to the element active when the confirmation opened.

### Keyboard matrix

| Key or gesture  | Context        | Expected behavior                                                                       |
| --------------- | -------------- | --------------------------------------------------------------------------------------- |
| Tab / Shift+Tab | Group open     | Moves between actions and surrounding page content.                                     |
| Enter / Space   | Focused action | Activates the native Button action.                                                     |
| Escape          | Group open     | The topmost InlineConfirm cancels, prevents the page Escape action, and restores focus. |
| Pointer click   | Either action  | Runs the same cancel or confirm lifecycle as keyboard activation.                       |

### Assistive-technology announcements

The visible prompt names the group and both actions have specific visible labels. The component does not use `role="alertdialog"`, `aria-modal`, or a live region because this is an in-flow decision rather than an urgent announcement.

## Verification

- Verify Cancel receives focus first.
- Verify Escape follows LIFO ordering with another overlay.
- Verify both actions and Escape close the group without a dialog element or scroll lock.
