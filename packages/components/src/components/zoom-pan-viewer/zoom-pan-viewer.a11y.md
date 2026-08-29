# ZoomPanViewer design and accessibility review

## Design review (required)

- Reviewer: Implementation review
- Review outcome: Approved. Bounded viewport with controls over content and no content-rendering assumptions.
- Nearest neighbours: Image, Carousel, CodeBlock.
- Why this component exists: It owns pointer-anchored zoom, drag panning, pinch scaling, and keyboard equivalents.
- Findings and resolutions: Reports transforms through `onTransformChange`; reset is explicit; controls use shared buttons and Lucide icons.

## Novel interaction accessibility review

- Applies: Yes—the viewer introduces a pointer and keyboard transform model.
- Reviewer: Implementation review
- Review outcome: Approved. Pointer capture supports dragging; controls provide an operable alternative.

### Focus management

The viewer is focusable and labelled by `ariaLabel`; focus remains on it while keyboard transforms operate. Zoom controls are independently focusable. There is no focus trap or overlay.

### Keyboard matrix

| Key or gesture | Context      | Expected behavior            |
| -------------- | ------------ | ---------------------------- |
| `+` / `=`      | Viewer       | Zoom in, clamped to range.   |
| `-` / `_`      | Viewer       | Zoom out, clamped to range.  |
| `0`            | Viewer       | Reset scale and pan.         |
| Enter / Space  | Zoom control | Activate the focused button. |
| Wheel          | Viewport     | Zoom about the pointer.      |
| One pointer    | Viewport     | Drag to pan.                 |
| Two pointers   | Viewport     | Pinch to zoom.               |

### Assistive-technology announcements

The viewport exposes its accessible label and button semantics. Controls announce “Zoom in”, “Reset zoom”, and “Zoom out”. Transform changes are not placed in a live region because they are direct-manipulation state.
