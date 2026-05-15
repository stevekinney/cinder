# Image — accessibility notes

`Image` is a thin wrapper around `<img>` that adds an aspect-ratio container,
a blur-up placeholder, and a fallback snippet. The accessible surface is the
`<img>` element itself in the happy path; when the image errors and a
`fallback` snippet renders, the wrapper takes over as the accessible image
surface.

## Required `alt`

`alt` is a required prop with no default. Consumers must decide explicitly
whether the image is decorative or meaningful:

- **Meaningful images** — pass a description that conveys the image's
  information or purpose.
- **Decorative images** — pass `alt=""`. Empty string is a valid accessible
  choice; it tells assistive tech the image is presentational and can be
  skipped. Making this an explicit decision (rather than a silent default)
  prevents the most common alt-text bug: missing `alt` attributes.

## Lazy loading defaults

`loading="lazy"` and `decoding="async"` are the defaults. For above-the-fold
hero images, override with `loading="eager"`. For LCP (Largest Contentful
Paint) hero images, combine `loading="eager"` with `fetchpriority="high"` —
which forwards through to the underlying `<img>` via rest props — so the
browser pushes the image to the top of its resource priority queue.

## Placeholder and error states

The blur-up placeholder is purely visual — it's painted as the wrapper's
background and the real `<img>` fades in over it once `load` fires. The
placeholder background is cleared after load so transparent images don't show
the low-res layer through them. Assistive tech only sees the `<img>` and its
`alt`; the placeholder is not announced.

When the image fails to load and a `fallback` snippet is provided, the
`<img>` is unmounted and the wrapper renders the fallback in its place. The
wrapper switches to `role="img"` with `aria-label={alt}` for that state, so
screen readers get a stable, named image surface regardless of what the
fallback renders. The consumer's fallback content (e.g. an icon, a skeleton)
sits inside this labeled region and inherits its accessible name from `alt`.

## Public CSS hooks

The wrapper exposes data attributes consumers can target:

- `[data-cinder-loaded]` — present once the real image has loaded.
- `[data-cinder-errored]` — present once the image has errored.
- `[data-cinder-fallback]` — present while the fallback snippet is rendering.

## Not for people

`Image` does not render initials and has no concept of identity. For
person-shaped thumbnails with initials fallback, use `Avatar`.
