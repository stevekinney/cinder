# Feed & FeedEvent — Accessibility Notes

## Semantic element choice

`Feed` renders an `<ol>` (ordered list). Feeds are chronologically ordered sequences — screen readers announce "list, N items" and expose list-navigation shortcuts (e.g. `Ctrl+Opt+L` on macOS VoiceOver). Do not swap for `<ul>` or `<div role="list">`: ordered lists carry the chronological meaning that matches the component's purpose.

Each `FeedEvent` renders an `<li>` inside that list. The tag is the correct content model for `<ol>` and carries list item semantics automatically.

## Accessible name — required but not type-enforced

The `<ol>` must have an accessible name. Provide one of:

```svelte
<!-- aria-label for a self-describing feed -->
<Feed aria-label="Pull request timeline">…</Feed>

<!-- aria-labelledby when there's a visible heading -->
<h2 id="timeline-heading">Timeline</h2>
<Feed aria-labelledby="timeline-heading">…</Feed>
```

TypeScript cannot express "at least one of two optional attributes is required" without breaking ergonomics, so this contract is documentation-only. A `Feed` without either attribute is silent to assistive technology users — they receive no list label and cannot distinguish this list from others on the page.

## ISO datetime — non-negotiable

`FeedEvent` always renders `<time datetime={datetime}>`. The `datetime` prop must be a valid ISO 8601 string (e.g. `"2026-05-12T14:30:00Z"`). The machine-readable value is owned by the component; the visible label inside `<time>` is the `timestamp` string (or the `timestampLabel` snippet for rich markup). When neither is supplied, the component falls back to the raw `datetime` string — deterministic and SSR-safe, with no locale or timezone dependence.

Never rely on a pre-formatted human string as the only representation. A `<time>` element with a proper `datetime` attribute allows parsers, assistive tech, and future tooling to extract the precise moment — visible text like "2m ago" carries none of that precision.

## Decorative rail — aria-hidden

The rail wrapper (`.cinder-feed-event-rail`) carries `aria-hidden="true"`. Both the icon badge and the dot are decorative — the event's semantic content lives in the body (the default children) and the visible `timestamp`.

**Consequence:** if you pass a meaningful icon (e.g. an avatar identifying the acting user), you must also duplicate that meaning in the body content. The icon snippet is visual reinforcement only; it is the sole carrier of meaning for no user.

Example — correct:

```svelte
<FeedEvent datetime="…" timestamp="2m ago">
  {#snippet icon()}<Avatar src={user.avatar} />{/snippet}
  <strong>{user.name}</strong> pushed 3 commits
</FeedEvent>
```

The connector line is a CSS `::after` pseudo-element and is therefore invisible to assistive technology by default — no extra ARIA is needed.

## Live region — opt-in via `live` prop

`live={false}` (default): no ARIA live attributes are set. A live region on a static feed is noise — screen readers may re-announce content on focus changes or adjacent DOM mutations.

`live={true}`: sets `aria-live="polite"` and `aria-atomic="false"` on the `<ol>`. Screen readers queue announcements without interrupting the user, and announce only the newly-added node rather than the entire list.

Use `live` only when items stream onto the page while the user is present (notifications, log tails, activity tickers).

### Prepend vs append

With `aria-live="polite"` and `aria-atomic="false"`, screen readers announce mutations regardless of insertion position. However, do not scroll the viewport on insertion — that would move the view from under keyboard and screen-reader users who are reading earlier content. Scroll only on explicit user gesture.

### Focus rescue

If a `FeedEvent` contains focusable controls (links, buttons) and that event is removed while focus lives inside it, focus jumps to `<body>`. The component does not attempt to rescue focus. Consumers who remove live events must detect this case and move focus to a safe target before removal.

## `role="feed"` — intentionally absent

The WAI-ARIA `feed` pattern requires `aria-busy`, `aria-setsize`, `aria-posinset`, and keyboard-managed navigation between articles. This component is presentational and cannot satisfy that contract.

If you need the full WAI-ARIA feed pattern, pass `role="feed"` via rest attributes and own the keyboard contract yourself. Reference: [WAI-ARIA Feed Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/feed/).

## Dense or long feeds

Prefer pagination or an explicit "Load more" control over infinite scroll. Infinite scroll requires screen-reader users to navigate through an ever-growing list without a clear end — a "Load more" button gives them explicit control over when new content arrives.

## Internal class hooks

The following class names are internal implementation details, subject to change. They are documented here as an escape hatch for consumers who need targeted overrides via the root `class` prop:

- `.cinder-feed-event-rail` — the icon/dot column
- `.cinder-feed-event-content` — the main body text area
- `.cinder-feed-event-time` — the `<time>` element

## Connector token coupling

The `::after` pseudo-element that draws the connector line uses two tokens that must stay in sync with their corresponding layout values:

- `inset-block-start: var(--cinder-space-6)` — must match `.cinder-feed-event-rail`'s `block-size`
- `inset-block-end: calc(-1 * var(--cinder-space-4))` — must match `.cinder-feed`'s `gap`
- `inset-inline-start: calc(var(--cinder-space-6) / 2)` — must match half of `.cinder-feed-event-rail`'s `inline-size`

If you change any of these layout tokens, update the others to match.
