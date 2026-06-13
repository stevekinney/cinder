# FacetedFilterBar accessibility

## Pattern

`FacetedFilterBar` is a composed filter surface, not a single widget. It uses the `role="search"` landmark to group the filtering controls. Individual controls within (search input, selects, chip remove buttons, clear-all button) follow their own native or ARIA patterns.

Roving-tabindex Toolbar semantics are intentionally NOT applied to the outer container: the search input and select controls own their own arrow-key semantics (text cursor, option navigation), which conflict with the toolbar pattern's arrow-key model. Normal Tab order is used throughout.

## Roles names states

| Element               | Role / Semantics                                             | Notes                                                                                                  |
| --------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Root `div`            | `role="search"`                                              | Consumer must supply a meaningful `aria-label` (e.g. `"Workflow filters"`).                            |
| Search input          | `type="search"`                                              | Provided by `SearchField`; inherits its own label and clear-button wiring.                             |
| Select facet `select` | Native `select`                                              | Labeled via `aria-label` attribute equal to `facet.label`; visually-hidden `label[for]` also rendered. |
| Applied-filter chip   | `span[data-cinder-mode="removable"]`                         | Chip's remove button carries `aria-label="Remove filter: {label}: {value}"`.                           |
| Clear-all `button`    | `type="button"`                                              | Visible text "Clear all" is the accessible name.                                                       |
| Live region `div`     | `role="status"` (`aria-live="polite"`, `aria-atomic="true"`) | Always in DOM; announces active filter count and values on change. Never conditionally rendered.       |

## Keyboard

| Key             | Action                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------- |
| Tab             | Move focus sequentially through search field, facet selects, chip remove buttons, clear-all button.     |
| Enter / Space   | Activate the focused button (clear-all, chip remove).                                                   |
| Arrow Up / Down | Navigate options within a focused native select.                                                        |
| Escape          | Clear search field text when the search input is focused (native browser behavior for `type="search"`). |

There is no roving-tabindex model; every interactive element is in the natural Tab order.

## Mouse / pointer

- Clicking a chip's remove button (×) fires `onfilterremove` with the chip's key.
- Clicking "Clear all" fires `onclearall`.
- Changing a select facet fires `onfacetchange` with the facet key and new value.
- Typing in the search field fires `onsearchchange` on every keystroke.
- The search field's clear button (rendered by `SearchField`) clears the query and fires `onsearchchange('')`.

## Hard scope caps

- The bar does not implement routing, URL-sync, or persistence. The consumer owns those.
- The bar does not implement data fetching or debouncing. The consumer owns those.
- No date-range primitive is included. A `type: 'custom'` facet with a consumer-supplied snippet is the extension point for date pickers.
- The bar does not implement a roving-tabindex toolbar model. Arrow-key navigation between controls is the responsibility of the individual controls (select, SearchField).
