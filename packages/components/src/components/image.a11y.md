# Image — accessibility notes

`Image` is a thin wrapper around `<img>` that adds aspect-ratio, a blur-up
placeholder, and a fallback snippet. The accessible surface is the `<img>`
element itself.

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
hero images, override with `loading="eager"` so the browser doesn't defer
the most important image on the page.

## Placeholder and error states

The blur-up placeholder is purely visual — it's painted as the wrapper's
background and faded out via opacity once the real image loads. Assistive tech
only sees the `<img>` and its `alt`; the placeholder is not announced.

When the image fails to load and a `fallback` snippet is provided, the
`<img>` is unmounted and the fallback renders in its place. If the fallback
itself contains imagery (e.g. a placeholder icon), the consumer is responsible
for the accessible name in that fallback content.

## Not for people

`Image` does not render initials and has no concept of identity. For
person-shaped thumbnails with initials fallback, use `Avatar`.
