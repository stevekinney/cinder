# Chat · accessibility

## Pattern

Chat packages a higher-level workflow. Confirm the composed controls, labels, states, and keyboard path match the domain task instead of treating the visual shell as the accessibility contract.

Purpose: Opinionated conversation surface bundling message list, composer, attachments, and scroll affordances for AI or support transcripts.

## Use when

- Shipping a full chat surface with composer, scroll-anchor, unread indicator, and attachments bundled as one heavyweight drop-in.
- Building an AI assistant or support thread where conversation state is modeled as a transcript of role-tagged messages.

## Avoid when

- Rendering a one-off message list — compose lighter primitives directly instead of pulling the full suite.
- The transcript is read-only and needs no composer — a simple list of message bubbles is a better fit.

## Keyboard and focus

Keyboard behavior follows the rendered native elements and any ARIA pattern documented by the component. Avoid adding handlers that change focus order without a matching visible and programmatic state update.

Keep focus indicators visible. If you wrap or restyle Chat, verify the focused element remains visually apparent in default and forced-colors modes.

## Names, roles, and state

Use the public props and documented examples to provide accessible names, descriptions, current state, disabled state, selection state, or value text. Do not rely on color, icon shape, placeholder text, or layout position as the only way to communicate meaning.

When Chat accepts snippets or arbitrary children, the caller owns the semantics inside those children. Prefer native elements first, and add ARIA only when it matches the rendered behavior.

## Verification

- Render Chat in the playground or a focused test fixture.
- Navigate the component with keyboard only.
- Inspect the accessible name, role, and state in browser accessibility tools.
- Check forced-colors mode when the component adds borders, focus rings, selected state, or status color.

## scrollFadeVisible (Tier 3 polish)

`scrollFadeVisible` paints an opaque, scroll-driven fade (never a `mask-`)
on the top and bottom edges of the message timeline as it overflows, using
`@lostgradient/cinder`'s shared `_scroll-fade.css` recipe. It is
presentation-only and never the sole signal that more messages exist — the
jump-to-latest button and unread-count indicator (`atBottom`, `unreadCount`,
`newMessageIndicatorVisible`) remain the authoritative affordances,
unaffected by this prop. The timeline's own `role="log"`/`aria-live` and
`:focus-visible` ring (documented above) are unchanged. Only visible when
`surfaceMode` is `'default'`: with `surfaceMode="transparent"` the timeline
paints no background of its own, so the JS driver is gated off entirely
rather than fading toward an incorrect color (see `chat.types.ts`).
`@media (forced-colors: active)` disables the fade outright.

Related components: `markdown-editor`.

## Nested transcript and navigation rail

`ChatSubSession` is a bounded, nested `role="log"` that reuses Chat's existing
message and typography contracts. Its reduced type ramp, 7.75rem clamp, and
edge fade preserve hierarchy without adding a second conversation model. Live
motion is limited to the child while `live` is true and is disabled under
`prefers-reduced-motion`.

`ChatNavigationRail` uses real buttons, `aria-current` from a Set of
IntersectionObserver hits, and `aria-describedby` preview text. Pointer capture
scrubbing maps to message rows and clamps beyond either end. The rail is a
navigation aid, never the only way to reach a message; the transcript remains
keyboard navigable. CSS sibling selectors provide proximity falloff without
per-row JavaScript. Reduced motion removes every rail transition.

Design review outcome: approved. The two surfaces are Chat-owned because they
need transcript identity and virtualization-aware navigation, while remaining
small enough to compose beside a Chat instance. No general table-of-contents
abstraction is introduced.

## Shared transcript entry frame

Reasoning, tool calls, approval details, and step groups use the same Collapsible-based entry frame. The nearest existing patterns are `Collapsible` for disclosure state and `RunStepTimeline` for grouped execution history. The frame exists to unify the trigger, chevron, expanded-region semantics, and bounded body while leaving each domain part responsible for its own status and controls.

Design review outcome: approved. The frame removes competing disclosure treatments without inventing a second visual hierarchy, keeps native button semantics, and preserves the existing tool-approval actions. Consecutive completed tool calls may collapse into a timeline summary; action-required calls stay individual so Approve and Reject remain available.

Accessibility review outcome: approved with an explicit scroll-fade boundary. The message timeline and non-interactive bounded reading regions may use the shared overflow fade. Keyboard-navigable toolbars, tab lists, menus, listboxes, and chip rows intentionally do not: roving focus can place an item flush against an edge, where an opaque fade would obscure its focus indicator or text. Firefox continues to receive the non-animation fallback or no decorative fade; no control depends on the fade to communicate overflow.
