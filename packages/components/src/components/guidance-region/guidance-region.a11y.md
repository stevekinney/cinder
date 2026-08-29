# GuidanceRegion design and accessibility review

## Design review (required)

- Reviewer: Cinder maintainers
- Review outcome: Approved for implementation review.
- Nearest neighbours: Popover, ModalRegion, ToastRegion.
- Why this component exists: It provides a region-scoped decision point for versioned product guidance without taking ownership of persistence.
- Findings and resolutions: `relevantFrom` and `relevantUntil` filter claims; one claim wins per boot; dismissal and reset use only the supplied storage adapter. Anchored claims compose Popover and modal claims compose `useModal`.

## Novel interaction accessibility review

- Applies: Yes—consumers may expose a claim through an anchored Popover or modal dialog.
- Reviewer: Cinder maintainers
- Review outcome: Approved for implementation review.

### Focus management

The registry never moves focus or inserts a trap. Anchored claims inherit Popover behavior; modal claims inherit ModalRegion capture, trapping, Escape, and restoration. Consumers provide a keyboard-reachable anchor and an accessible name.

### Keyboard matrix

| Key or gesture  | Context           | Expected behavior                                                       |
| --------------- | ----------------- | ----------------------------------------------------------------------- |
| Enter / Space   | Claim anchor      | Consumer opens the selected presentation.                               |
| Escape          | Claim surface     | Popover or Modal handles Escape through the shared stack.               |
| Tab / Shift+Tab | Modal claim       | Focus remains inside the modal until dismissal.                         |
| Dismiss / reset | Guidance controls | State changes through the region API and supplied storage adapter only. |

### Assistive-technology announcements

The registry emits no live region and invents no accessible name. Consumers provide Popover labelling or Modal title/label; claim content includes visible action and dismissal text.

## Verification

- Register a claim twice and verify only the first call wins.
- Verify both version boundaries exclude claims outside their inclusive window.
- Verify dismiss and reset call only the supplied adapter.
