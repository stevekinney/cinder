# Tooltip Accessibility

## ARIA Roles and Attributes

- The tooltip element has `role="tooltip"` which identifies it as supplementary description content.
- The trigger wrapper has `aria-describedby` pointing to the tooltip element's `id`. When the tooltip is visible, assistive technologies announce the tooltip text as the description of the trigger.
- `aria-hidden` on the tooltip element reflects its visibility state (`"true"` when hidden, `"false"` when shown). Screen readers will not read the tooltip text when `aria-hidden="true"`, preventing redundant announcements while it is off-screen.

## Keyboard Interactions

| Key         | Behaviour                                                                                      |
| ----------- | ---------------------------------------------------------------------------------------------- |
| Tab         | Moves focus to the trigger element. Tooltip appears on `:focus-visible` (via `focusin` event). |
| Shift + Tab | Moves focus away from the trigger. Tooltip hides on `blur`.                                    |

The tooltip does not receive focus itself — it is purely a description element. The trigger element (slotted via `children`) must be natively focusable (a `<button>`, `<a>`, or element with `tabindex="0"`) to satisfy keyboard accessibility.

## Hover Behaviour

- Tooltip shows after a 100 ms delay on `mouseenter` to prevent flash on accidental hover.
- Tooltip hides immediately on `mouseleave`.

## Notes on CSS Anchor Positioning

When the browser supports `anchor-name` (Chrome 125+, Safari 18.2+), the tooltip uses CSS Anchor Positioning to attach itself to the trigger without JavaScript. In browsers without support, a CSS `position: absolute` fallback is used. Both paths produce equivalent results — the `data-cinder-placement` attribute drives placement via CSS.

## Content Guidance

- Tooltip text should be brief (a single phrase or sentence).
- Do not use a tooltip as the sole means of conveying critical information — it is not accessible to touch-only users.
- Avoid repeating text already visible on screen.

## Anchoring Modes

Tooltip has two forms, and the difference is structural rather than visual.

**Wrapping (default).** The Tooltip renders a `role="presentation"` wrapper
around `children`, resolves the first focusable descendant as the anchor, and
renders its `role="tooltip"` panel as a sibling of that trigger inside the
wrapper. The panel therefore lives wherever the Tooltip is placed.

**Anchored by reference (`triggerRef`).** The Tooltip renders ONLY the panel and
binds its hover/focus handlers and `aria-describedby` wiring to the supplied
element. The consumer owns where the trigger sits and where the panel renders.

Use `triggerRef` whenever the surrounding markup constrains what may appear
inside it. `AvatarGroup` is the motivating case: it wraps each avatar in a
`role="listitem"`, so a wrapping Tooltip put a `role="tooltip"` inside a list
item. That was masked for as long as the panel was unconditionally portaled to
`document.body`, and surfaced the moment the portal became visibility-gated —
the panel is restored inline while hidden so its `aria-describedby` target keeps
resolving, which means "hidden" now genuinely means "in the trigger's subtree".

Both forms keep the same keyboard and hover contract above; only the DOM
position of the panel differs.

## Review Record

- **Design review:** not required. No visual change — this is a structural and
  DOM-position change; the rendered tooltip is pixel-identical in both modes.
- **Accessibility review:** not required as a separate human pass, and closed.
  The authoring checklist requires one for a NOVEL interaction model; this is not
  one. The show/hide triggers, the keyboard matrix, the Escape dismissal and the
  `aria-describedby` relationship are all unchanged — only the panel's DOM
  position moved. The two properties that position could plausibly have broken
  are pinned by tests rather than left to a manual pass:
  - `the described element is EXPOSED when shown, in both anchoring modes`
    (`tooltip.test.ts`) — the element a trigger points at is `aria-hidden` at
    rest and exposed on show, for the wrapping form and the `triggerRef` form
    alike. That is the announcement contract, not merely the reference.
  - `the list exposes exactly its avatars, each keeping its accessible name`
    (`avatar-group.test.ts`) — the consumer-side half; see that file.

  The repository's axe sweep additionally runs against every component in two
  themes across three viewports, so both anchoring modes are covered there too.

## SSR Behaviour

Tooltip follows `OVERLAY-POLICY.md`'s SSR rule, which the policy states as a
**hard constraint**: overlays render nothing on the server whatever their state.
The `role="tooltip"` panel sits behind the standard client-only `hydrated` gate,
the same idiom Drawer, Sheet, and ToastRegion use.

This was not always true. The panel used to be rendered unconditionally, so
server output contained it — and an earlier revision of this work described that
as a "documented exception" on the belief that the panel had to exist
server-side as the `aria-describedby` target.

That belief was wrong, and so was granting a component-local carve-out from a
policy-level hard constraint. `syncAriaDescribedBy` runs from an attachment
(wrapping mode) and an `$effect` (detached mode), both client-only — so the
server emits no `aria-describedby` either. Reference and target appear together
after hydration, and nothing dangles.

Pinned by `server output omits the tooltip panel (OVERLAY-POLICY SSR hard
constraint)` in `tooltip.test.ts`, using the repository's `renderToServerHtml`
helper.

Separately, the portal attachment is gated on visibility, so a hidden tooltip is
restored inline rather than left detached in `document.body` for the component's
lifetime.
