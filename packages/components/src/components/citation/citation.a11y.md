# Citation design and accessibility review

This record documents the design and accessibility review for the inline source
marker and its HoverCard disclosure.

## Design review (required)

- Reviewer: Cinder maintainers
- Review outcome: Approved.
- Nearest neighbours: HoverCard and Pagination.
- Why this component exists: It combines an inline source marker with paginated source disclosure, which neither neighbour provides alone.
- Findings and resolutions: The marker is a keyboard-focusable native button; each source keeps a native link when a URL is supplied; pagination exposes its current position and disables unavailable directions.

## Novel interaction accessibility review

A novel interaction model includes a new disclosure or keyboard pattern,
entering or leaving the top layer, or making previously static content
interactive.

- Applies: Yes—the marker opens a rich HoverCard disclosure and the disclosure contains interactive source links and pagination controls.
- Reviewer: Cinder maintainers
- Review outcome: Approved.

### Focus management

Focus enters the marker through normal document order. HoverCard opens on focus and
keeps the marker as the trigger; Escape and pointer/focus exit dismiss the card.
Focus returns to the marker after dismissal, and removing the trigger safely
unmounts the card.

### Keyboard matrix

| Key or gesture | Context            | Expected behavior                                    |
| -------------- | ------------------ | ---------------------------------------------------- |
| Enter or Space | Citation marker    | Open the source HoverCard.                           |
| Tab            | Open card          | Reach source links and pagination controls in order. |
| Escape         | Open card          | Dismiss the HoverCard and restore trigger context.   |
| Shift+Tab      | Pagination control | Move backward through the normal focus order.        |

### Assistive-technology announcements

The marker is a button named “Sources (N)” and exposes the HoverCard through the
existing HoverCard trigger semantics. Source details use native headings,
paragraphs, and links. The current-page text is polite live text (“N of M”);
disabled previous/next buttons communicate pagination bounds. Verified against
keyboard navigation and the browser accessibility tree in Chromium with the
default light and dark themes.
