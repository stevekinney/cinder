# PayloadInspector · accessibility

## Pattern

WAI-ARIA Authoring Practices: [Tabs](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/). The view switcher (Summary / Tree / Raw) is a full Tabs composite built on cinder's `Tabs`, `TabList`, `Tab`, and `TabPanel` primitives. The outer container is a `<section>` landmark with an `aria-label` identifying it as an inspector region.

## Roles names states

- The outer `<section>` carries `aria-label` (defaults to "Payload inspector"). Screen readers announce it as a landmark, which lets users navigate directly to the inspector.
- `TabList` carries `role="tablist"` with `aria-label="Inspector views"` and `aria-orientation="horizontal"`.
- Each `Tab` carries `role="tab"`, `aria-selected="true|false"`, and `aria-controls` pointing at its paired panel id.
- Each `TabPanel` carries `role="tabpanel"`, `aria-labelledby` pointing at the corresponding tab, and `tabindex="0"`.
- The byte size `<span>` carries an `aria-label` (e.g. "13 B payload size") so screen readers have context without relying on visual proximity.
- Parse error notices carry `role="alert"` — they are announced immediately when the parsing fails.
- Empty-state placeholders carry `role="status"` — announced politely.
- Copy buttons from `CopyButton` carry their own `aria-live="polite"` announcements for the "Copied" confirmation state.

## Keyboard

The horizontal tab list uses the WAI-ARIA default for horizontal: focus movement also activates the tab.

| Key                | Action                                                                     |
| ------------------ | -------------------------------------------------------------------------- |
| Tab                | Move focus into the tab list, then Tab again to move into the active panel |
| ArrowRight         | Move focus and activate the next tab (wraps from Raw back to Summary)      |
| ArrowLeft          | Move focus and activate the previous tab (wraps from Summary to Raw)       |
| Home               | Focus and activate the first tab (Summary)                                 |
| End                | Focus and activate the last tab (Raw)                                      |
| Tab (inside panel) | Move focus through interactive elements inside the active panel            |

## Mouse / pointer

Clicking a tab activates it and shows its panel. Clicking a copy button copies the payload to the clipboard and briefly changes the button label to its confirmation state.

## Hard scope caps

- Search, filtering, and virtualization over the JSON tree are not in scope. The built-in `JsonViewer` has a hard byte cap (default 1 MB) after which it shows an oversize placeholder.
- The raw view uses `CodeBlock` with `highlight={false}` — an absolute off-switch that triggers no Shiki import and renders guaranteed-escaped plaintext. This keeps payload data out of the highlight call chain.
- The inspector does not annotate individual JSON keys or values with ARIA descriptions. Consumers who need richer key-level semantics should compose a custom viewer.
