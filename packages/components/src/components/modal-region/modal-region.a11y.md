# ModalRegion design and accessibility review

## Design review (required)

- Reviewer: Cinder maintainers
- Review outcome: Approved for implementation review.
- Nearest neighbours: Modal, ConfirmDialog, ToastRegion.
- Why this component exists: It gives descendants an imperative, promise-based entry point while keeping modal state scoped to the mounted region.
- Findings and resolutions: `openModal` renders the supplied component inside the existing `Modal`; stable ids deduplicate concurrent requests; `confirm` resolves to a boolean. Declarative `Modal` remains preferred when a trigger owns local state.

## Novel interaction accessibility review

- Applies: Yes—entries enter the modal top layer and inherit modal focus, scroll-lock, Escape, and transition behavior.
- Reviewer: Cinder maintainers
- Review outcome: Approved for implementation review.

### Focus management

`Modal` captures the active element, focuses meaningful dialog content, traps focus while open, and restores focus after dismissal. Region teardown resolves pending entries without leaving an orphaned dialog.

### Keyboard matrix

| Key or gesture          | Context              | Expected behavior                                                                     |
| ----------------------- | -------------------- | ------------------------------------------------------------------------------------- |
| Escape                  | Topmost region modal | Modal dismisses through the shared LIFO stack and resolves confirmation as cancelled. |
| Tab / Shift+Tab         | Modal open           | Focus cycles within the dialog.                                                       |
| Enter / Space           | Confirm action       | ConfirmDialog invokes its action and resolves `confirm()` to `true`.                  |
| Backdrop / close button | Dismissible modal    | Modal closes through its transition lifecycle and resolves as cancelled.              |

### Assistive-technology announcements

The existing native-dialog-based `Modal` supplies `role="dialog"`, `aria-modal`, and a required title. `ConfirmDialog` supplies labelled cancel and confirm buttons plus an optional description. No duplicate live announcement is emitted.

## Verification

- Verify two providers do not share entries.
- Verify duplicate ids render one dialog.
- Verify confirm, cancel, and Escape return the expected boolean.
- Verify server rendering emits no modal surface before hydration.
