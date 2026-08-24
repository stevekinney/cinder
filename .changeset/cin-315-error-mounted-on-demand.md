---
'@lostgradient/cinder': minor
---

`FormFieldFrame`'s internal error live region now mounts by default (as an empty `aria-live` region) instead of only when a form field opted in via `errorAlwaysMounted`. This fixes `Input` and `Checkbox` (and every other `FormFieldFrame` consumer that didn't already opt in) mounting their error live region only once an error was actually set, which meant a freshly-mounted `aria-live` node was not reliably announced by NVDA/JAWS the first time an error appeared.

**Migration note:** the `errorAlwaysMounted` prop on the internal `FormFieldFrame` primitive has been removed with no compatibility alias. The always-mounted behavior it used to opt into is now the default. A new `errorMountedOnDemand?: boolean` prop (default `false`) opts back into the old on-demand-mount behavior for a consumer that has a specific reason to skip pre-mounting the error region. This is an internal primitive (`_internal/form-field-frame.svelte`), not part of the public component API, so most consumers of `@lostgradient/cinder` are unaffected. It is breaking only for code that imported `FormFieldFrame` directly (an unsupported internal path) and passed `errorAlwaysMounted`.

Known limitation carried over, not fixed here: `Input` and `Checkbox` still wrap their entire `FormFieldFrame` in `{#if label || description || error}` (`Checkbox`: `{#if renderInlineLabel || description || error}`), so the error region still isn't mounted at all when none of those are set. The default flip only fixes the ordering once `FormFieldFrame` renders — it does not force `FormFieldFrame` to always render.
