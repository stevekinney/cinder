# ToastRegion

A region-scoped queue for transient notifications. `<ToastRegion>` owns the two stacked aria-live regions (polite for `info`/`success`, assertive for `warning`/`danger`); `useToast()` returns the dispatcher API to any descendant. See [`./toast-region.a11y.md`](./toast-region.a11y.md) for the ARIA contract.

## Placement

Mount one `<ToastRegion />` near the root of the app — `+layout.svelte` for SvelteKit, the top-level component for a single-page app.

```svelte
<!-- +layout.svelte -->
<script lang="ts">
  import { ToastRegion } from 'cinder';
  let { children } = $props();
</script>

<ToastRegion>
  {@render children()}
</ToastRegion>
```

Wrap the app inside the region so route components (descendants) can call `useToast()`. `useToast()` throws (see below) if no region is mounted above the caller. Multiple regions are legal: each owns an independent queue scoped to its subtree (see [Region scope](./toast-region.a11y.md#region-scope)).

## `<ToastRegion>` props

| Prop              | Type      | Default | Description                                                                                                                                                                                          |
| ----------------- | --------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `maxStack`        | `number`  | `5`     | Maximum simultaneous toasts in **each** region (polite and assertive each hold up to this many). Overflow drops the oldest.                                                                          |
| `defaultDuration` | `number`  | `5000`  | Auto-dismiss duration in milliseconds. `0` makes a toast sticky. Overridable per-call via `ToastOptions.duration`.                                                                                   |
| `class`           | `string`  | —       | Additional class names merged with `.cinder-toast-region`.                                                                                                                                           |
| `children`        | `Snippet` | —       | Optional. When supplied, descendants of the snippet can call `useToast()` and read the region's API. Most apps leave this empty and dispatch from elsewhere via a separately-mounted region context. |

The `ToastRegionProps` type is re-exported from the package root for wrapper components.

## `useToast()`

Import the hook from the package root — there is no `cinder/use-toast` subpath. Call it during component initialization (Svelte's `getContext` requires it).

```svelte
<script lang="ts">
  import { useToast } from 'cinder';
  const toast = useToast();
</script>

<button onclick={() => toast.show('Saved your changes.', { variant: 'success' })}> Save </button>
```

`useToast()` throws `'useToast() must be called inside a <ToastRegion />. Mount one in your root layout.'` when no region is mounted above the caller. This is intentional: it surfaces a misconfigured layout immediately rather than silently swallowing dispatches.

## `ToastOptions`

| Field         | Type                                                          | Default                                 | Description                                                                                                                                 |
| ------------- | ------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `variant`     | `'info' \| 'success' \| 'warning' \| 'danger'`                | `'info'`                                | Drives visual treatment **and** live-region routing (see [Variant routing](#variant-routing-polite-vs-assertive)).                          |
| `duration`    | `number`                                                      | region's `defaultDuration` (`5000`)     | Auto-dismiss after N ms. `0` keeps the toast until dismissed manually.                                                                      |
| `dismissible` | `boolean`                                                     | `true`                                  | When `true`, renders the X button.                                                                                                          |
| `id`          | `string`                                                      | `cinder-toast-${n}` (auto-incrementing) | Pass a stable id to deduplicate — calling `show` again with the same id replaces the existing toast instead of stacking a duplicate.        |
| `action`      | `{ label: string; onAction: () => void; keepOpen?: boolean }` | —                                       | Renders a button after the message. Clicking invokes `onAction` then dismisses the toast unless `keepOpen` is `true` (defaults to `false`). |

## Variant routing (polite vs assertive)

`variant` is not just a visual prop — it determines which live region the toast announces through.

| Variants            | Live region     | ARIA role | `aria-live` |
| ------------------- | --------------- | --------- | ----------- |
| `info`, `success`   | polite stack    | `status`  | `polite`    |
| `warning`, `danger` | assertive stack | `alert`   | `assertive` |

The polite stack queues announcements behind the user's current screen-reader focus — informational, non-interrupting. The assertive stack interrupts. `maxStack` applies per-stack: a region can hold up to `maxStack` polite toasts **and** `maxStack` assertive toasts simultaneously. See [`./toast-region.a11y.md`](./toast-region.a11y.md) for the full ARIA rationale.

> [!TIP]
> Match urgency to variant. A `success` toast for "Saved" is informational; a `danger` toast for "Failed to save" interrupts because the user needs to know now.

## `show()` return value

`show()` returns a `string` — the assigned toast id. Capture it to enable targeted dismiss:

```ts
const id = toast.show('Saving…', { duration: 0 });
// …later, when the operation completes:
toast.dismiss(id);
```

Auto-generated ids (`cinder-toast-N`) are session-local and not stable across reloads. Use them transiently within the current session, or pass a stable `options.id` when you need cross-render deduplication.

## Action buttons

Pass `action: { label, onAction, keepOpen? }` to render a button after the message.

```ts
toast.show('Item moved to trash.', {
  variant: 'info',
  action: {
    label: 'Undo',
    onAction: () => restoreItem(),
  },
});
```

By default the toast dismisses immediately after `onAction` fires. Set `keepOpen: true` to persist the toast after the action runs — useful when the action kicks off async work the user should keep visible feedback about. The action button is focusable inside the live region so keyboard users can Tab to it after the announcement (see [Action button](./toast-region.a11y.md#action-button) in the a11y doc).

## Modal-scoped regions via `children`

`<ToastRegion>` accepts a `children` snippet. Nesting a region inside a modal scopes dispatched toasts to that modal's lifecycle — when the modal unmounts, the region's `onDestroy` clears any pending timers.

```svelte
<Modal bind:open title="Edit profile">
  <ToastRegion>
    {#snippet children()}
      {@const toast = useToast()}
      <!-- form inputs… -->
      <Button label="Save" onclick={() => toast.show('Saved.', { variant: 'success' })} />
    {/snippet}
  </ToastRegion>
</Modal>
```

`useToast()` inside the snippet resolves to the nearest enclosing region — in this case, the modal-scoped one. Toasts dispatched here do not appear in any outer app-root region.

## Dismiss patterns

There are four ways a toast leaves the screen:

- **User-driven** via the X button (when `dismissible: true`, the default).
- **Auto-dismiss** after `duration` ms (when `duration > 0`).
- **Targeted programmatic** via `toast.dismiss(id)`. No-op if the id is not active.
- **Clear-all** via `toast.dismissAll()`. Clears polite **and** assertive stacks together.

```ts
toast.dismiss(id); // remove a specific toast
toast.dismissAll(); // clear everything in this region
```

## Accessibility

See [`./toast-region.a11y.md`](./toast-region.a11y.md) for the full ARIA / live-region / reduced-motion documentation. Anything visible to assistive technology — announcement priorities, atomic updates, teardown behavior — is documented there, not duplicated here.

## v1 limitations

- **No pre-mount buffering.** `useToast()` throws during init if no region is mounted above the caller. There is no out-of-band dispatcher that buffers pre-mount calls.
- **No process-global singleton.** State is region-scoped via Svelte context. Apps with multiple regions get independent queues.
- **No position/placement prop.** The region renders in its default position; visual placement is owned by `.cinder-toast-region` styling. A placement prop is a roadmap item.
- **`maxStack` is per-stack, not combined.** A region can hold up to `maxStack` polite toasts **and** up to `maxStack` assertive toasts at the same time.
- **`id` deduplication is exact-match.** Calling `show` with an active id replaces the existing entry. There is no fuzzy or prefix match.
