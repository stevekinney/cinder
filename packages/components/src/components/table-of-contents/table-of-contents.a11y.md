# TableOfContents Accessibility Notes

## Landmark and name

`TableOfContents` renders a `<nav aria-label="…">` landmark and defaults the
name to `"On this page"`. Consumers can override `ariaLabel` for context-specific
landmark naming when multiple nav landmarks exist.

## Current section semantics

The active heading link uses `aria-current="location"`, which lets assistive
technology announce the current in-page location while preserving native link
behavior.

## Keyboard model

The component is a standard list of links, so it follows native document
navigation behavior:

| Key                 | Behavior                                       |
| ------------------- | ---------------------------------------------- |
| `Tab` / `Shift-Tab` | Moves between TOC links in document tab order. |
| `Enter`             | Activates the heading link.                    |

No roving tabindex or arrow-key management is applied.

## Motion

Click navigation uses smooth scrolling by default and switches to `'auto'` when
`prefers-reduced-motion: reduce` is active via the shared `useReducedMotion()`
utility.
