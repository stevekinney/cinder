# RunStepTimeline accessibility

## Pattern

This component follows the ARIA ordered list pattern for the outer rail and the ARIA disclosure button pattern for expandable detail panels (via `Collapsible`). The active step uses `aria-current="step"`, matching the Steps component pattern from ARIA Authoring Practices.

## Roles names states

The outer element is an `ol` (ordered list). It receives its accessible name from:

1. `aria-labelledby` (highest priority — points to a visible label element)
2. `aria-label` (explicit override)
3. `label` prop (falls back to this as `aria-label` when neither of the above is present)

Each step is an `li`. When one or more non-terminal steps are current (`running`, `retrying`, or `waiting_approval`), only the deepest current row receives `aria-current="step"` so nested child-workflow lanes announce a single active position.

The status dot on the rail is wrapped in a `span` with `aria-hidden="true"` and `inert`. It is purely decorative. The status text badge communicates the step state as text and includes an accessible label such as "Status: Waiting approval", so state is never conveyed by color alone (WCAG 1.4.1).

Progress bars use `role="progressbar"` (from the `Progress` component) with `aria-label` set to `"{step.label} progress"`, `aria-valuenow`, `aria-valuemin`, and `aria-valuemax`.

Expandable detail panels are rendered with `Collapsible`, which emits a `button[aria-expanded][aria-controls]` trigger and a `div[role="region"][aria-labelledby]` panel. See `collapsible.a11y.md` for the full disclosure pattern.

Step metadata (start time, end time, duration, attempt count) is rendered in a `dl` / `dt` / `dd` structure so screen readers can associate each label with its value.

Nested `children` steps are flattened into the same ordered list and identified with stable path attributes. Visual indentation creates child-workflow lanes without adding nested interactive regions or extra list containers.

## Keyboard

| Key   | Action                                                                                   |
| ----- | ---------------------------------------------------------------------------------------- |
| Tab   | Move focus into and through the component                                                |
| Enter | Toggle an expandable detail panel open or closed (when a Collapsible trigger is focused) |
| Space | Toggle an expandable detail panel open or closed (when a Collapsible trigger is focused) |

The outer `ol` is not keyboard-focusable. Focus lands on individual Collapsible trigger buttons inside steps that have detail panels and on optional step links.

## Mouse / pointer

Clicking the Collapsible trigger header inside a detail section toggles the panel open or closed. Optional links navigate normally. Step rows themselves are read-only.

## Hard scope caps

- The component does not manage a live region. Current states are communicated via `aria-current="step"` and status badge text, not via `role="status"` or `aria-live`. Consumers who need announcements when a new step starts should manage their own live region outside the component.
- Status dots are decorative. They must never contain focusable descendants.
- The component does not scroll to the active step. Consumers requiring scroll-into-view behavior for long step lists should implement this externally.
