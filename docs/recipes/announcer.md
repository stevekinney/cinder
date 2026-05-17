# Live-region announcer for transient messages

`useAnnouncer` is a Svelte 5 hook that drives a screen-reader live region from imperative announcements. You call `announcer.announce('Saved')`, the hook flickers the text into a live-region `<div>` long enough for assistive tech to pick it up, and then clears the region so the same string can be announced again later. The live region itself stays in your template; the hook owns the timing.

## When to reach for it

Use it for transient announcements that have no persistent visual equivalent on the page:

- Form submission success: `Profile saved`.
- Async operation results: `3 items imported`.
- Copy-to-clipboard confirmations: `Copied to clipboard`. The shipped [`CopyButton`](../../packages/components/src/components/copy-button.svelte) component owns the visual side of this one—pair them when the announcement should run alongside an icon-only button.
- Status changes that already produce a visible diff but warrant an SR-only confirmation: `Filter applied — 12 results`.

## When _not_ to reach for it

A live region is the wrong shape for anything persistent, visible, or critical:

- For a visible, dismissible message, use [`Banner`](../../packages/components/src/components/banner.svelte) or [`Alert`](../../packages/components/src/components/alert.svelte).
- For a transient floating message _with_ visible UI, use [`ToastRegion`](../../packages/components/src/components/toast-region.svelte) + `useToast`. The toast machinery already announces its own messages; layering an announcer on top double-announces.
- For a permanently-rendered status label (something like "Auto-saved at 2:14pm" sitting in a footer), render a static `aria-live` region directly. The hook earns its keep on one-shot announcements; for steady-state text, plain reactive markup is simpler.

## The markup pattern

The canonical pairing is one live-region `<div>` near the root of your component or app shell, fed by the hook:

```svelte
<script lang="ts">
  import { useAnnouncer } from 'cinder';

  const announcer = useAnnouncer();

  function handleSubmit() {
    // ...submit logic
    announcer.announce('Profile saved');
  }
</script>

<form onsubmit={handleSubmit}>
  <!-- ...form fields -->
</form>

<div aria-live="polite" aria-atomic="true" class="cinder-sr-only">
  {announcer.message}
</div>
```

A few things to notice in that snippet:

- **`aria-live="polite"`** waits for the current speech queue to drain before announcing. Right for non-urgent updates, which is almost everything.
- **`aria-atomic="true"`** asks assistive tech to re-read the full live-region content when any part of it changes. Without it, some screen readers read only the diff, which produces weird partial announcements when one message replaces another.
- **`class="cinder-sr-only"`** is the visually-hidden utility shipped by `cinder/styles` (defined in `packages/components/src/styles/utilities.css`). It uses the canonical clip-rect technique—the live region stays in the accessibility tree and out of the visual layout.

> [!NOTE]
> If you're coming from accessibility writing that uses the `.visually-hidden` / `.focusable` class names, the equivalents here are `.cinder-sr-only` and `.cinder-sr-only-focusable`. Same technique, namespaced.

## Polite vs assertive

The `aria-live` attribute on _your_ `<div>` is the contract—the hook does not encode politeness. `polite` is the default in the recipe above and the right choice for almost everything: success confirmations, status updates, filter results, search-result counts.

Reserve **`aria-live="assertive"`** for genuinely urgent state—the destructive action that just failed, the connection that just dropped. Assertive announcements interrupt whatever the screen reader is currently saying, which is jarring if you reach for it too often.

The conventional pattern is one `polite` region per page (or per layout region), and a _separate_ `aria-live="assertive"` `<div>` with its own `useAnnouncer()` call if you need urgent announcements:

```svelte
<script lang="ts">
  import { useAnnouncer } from 'cinder';

  const status = useAnnouncer();
  const alerts = useAnnouncer();
</script>

<div aria-live="polite" aria-atomic="true" class="cinder-sr-only">
  {status.message}
</div>

<div aria-live="assertive" aria-atomic="true" class="cinder-sr-only">
  {alerts.message}
</div>
```

## `clearDelay` and `debounceMs`

`AnnouncerOptions` has two knobs, and the defaults are tuned for the common case:

- **`clearDelay`** (default `1000` ms): how long the message stays in the live region before the hook auto-clears it. Clearing matters because announcing the same string twice in a row—`Saved`, then `Saved` again—needs the live region to go empty in between, or screen readers see "no change" and stay quiet. Bump this up to ~3000 ms for longer multi-clause messages.
- **`debounceMs`** (default `0`): a debounce window applied to `announce()` itself. Useful when calls fire in rapid succession—typing indicators, search-result counts that re-tally on every keystroke. `useAnnouncer({ debounceMs: 300 })` collapses a burst of `announce('Searching...')` calls into a single announcement at the trailing edge.

```ts
const announcer = useAnnouncer({ clearDelay: 3000, debounceMs: 300 });
```

## Cleanup

The hook installs a `$effect` cleanup that clears every pending `setTimeout` when the component unmounts. In normal usage you don't have to call anything yourself.

The `destroy()` method exists for the rare case where you need to tear down before unmount—imagine a long-lived parent component imperatively re-keying the announcer instance:

```ts
const announcer = useAnnouncer();

// Later, before unmount:
announcer.destroy();
```

If you're not doing anything fancy, ignore `destroy()` and let the effect cleanup do its job.

## Pitfalls

A few traps worth flagging:

- **Don't mount multiple `polite` live regions at the same DOM depth.** Assistive tech may collapse them or read out of order. One `polite` region per layout region is the rule of thumb. Same for `assertive`.
- **Never render visible UI inside the live-region `<div>`.** The `.cinder-sr-only` clip-rect utility is non-negotiable—visible content inside the live region produces both visual layout breakage and inconsistent SR behavior across browsers.
- **Don't pass `announcer.message` to a derived computation that expects stable references.** The message intentionally goes empty between announcements as part of the re-announcement trick; downstream `$derived` will see those transitions and react accordingly.
- **Don't call `announce()` from inside `$derived` or `$effect.pre`.** Call it from event handlers or other concrete user-driven entry points. Announcements wired to derivation cycles tend to fire on every input keystroke, which is exactly what `debounceMs` is for—but only if `announce()` is reached from an event handler, not from inside a reactive computation.

## Related

- [`Banner`](../../packages/components/src/components/banner.svelte): visible persistent messaging.
- [`Alert`](../../packages/components/src/components/alert.svelte): visible dismissible messaging.
- [`ToastRegion`](../../packages/components/src/components/toast-region.svelte) + `useToast`: transient visible notifications with their own internal announcement mechanics.
- [`VisuallyHidden`](../../packages/components/src/components/visually-hidden.svelte): the inverse of a live region—visible-to-SR content hidden from sighted users, without `aria-live` semantics.
