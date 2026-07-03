# ToastRegion

A region-scoped queue for transient notifications. `<ToastRegion>` owns the two stacked aria-live regions (polite for `info`/`success`, assertive for `warning`/`danger`); `useToast()` returns the dispatcher API to any descendant. See [`./toast-region.a11y.md`](./toast-region.a11y.md) for the ARIA contract.

## Placement

Mount one `<ToastRegion />` near the root of the app — `+layout.svelte` for SvelteKit, the top-level component for a single-page app.

```svelte
<!-- +layout.svelte -->
<script lang="ts">
  import { ToastRegion } from '@lostgradient/cinder/toast-region';
  let { children } = $props();
</script>

<ToastRegion>
  {@render children()}
</ToastRegion>
```

Wrap the app inside the region so route components (descendants) can call `useToast()`. `useToast()` throws (see below) if no region is mounted above the caller. Multiple regions are legal: each owns an independent queue scoped to its subtree (see [Region scope](./toast-region.a11y.md#region-scope)).

## `<ToastRegion>` props

| Prop              | Type                                                                                              | Default          | Description                                                                                                                                                                                                                                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `maxStack`        | `number`                                                                                          | `5`              | Maximum simultaneous toasts in **each** region (polite and assertive each hold up to this many). Overflow drops the oldest.                                                                                                                                                                                              |
| `defaultDuration` | `number`                                                                                          | `5000`           | Auto-dismiss duration in milliseconds. `0` makes a toast sticky. Overridable per-call via `ToastOptions.duration`.                                                                                                                                                                                                       |
| `position`        | `'top-left' \| 'top-center' \| 'top-right' \| 'bottom-left' \| 'bottom-center' \| 'bottom-right'` | `'bottom-right'` | Viewport anchor for both live-region channels.                                                                                                                                                                                                                                                                           |
| `class`           | `string`                                                                                          | —                | Additional class names merged with `.cinder-toast-region`.                                                                                                                                                                                                                                                               |
| `children`        | `Snippet`                                                                                         | —                | Optional snippet rendered inside the region. Supply it when callers need access to this region's `useToast()` context — either via `{@const toast = useToast()}` inside the snippet, or in any descendant component rendered through `{@render children()}`. Callers outside the region's subtree cannot dispatch to it. |

The `ToastRegionProps` type is re-exported from the package root for wrapper components.

## `useToast()`

Import the hook from the toast-region subpath. Call `useToast()` from anywhere inside the region's subtree: a descendant component's `<script>`, or a `{@const}` binding inside a `{#snippet children()}` of the region. Both resolve the same context.

```svelte
<script lang="ts">
  import { useToast } from '@lostgradient/cinder/toast-region';
  const toast = useToast();
</script>

<button onclick={() => toast.show('Saved your changes.', { variant: 'success' })}> Save </button>
```

`useToast()` throws `'useToast() must be called inside a <ToastRegion />. Mount one in your root layout.'` when no region is mounted above the caller. This is intentional: it surfaces a misconfigured layout immediately rather than silently swallowing dispatches.

## `ToastOptions`

| Field         | Type                                                          | Default                                 | Description                                                                                                                                                       |
| ------------- | ------------------------------------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `variant`     | `'info' \| 'success' \| 'warning' \| 'danger'`                | `'info'`                                | Drives visual treatment **and** live-region routing (see [Variant routing](#variant-routing-polite-vs-assertive)).                                                |
| `duration`    | `number`                                                      | region's `defaultDuration` (`5000`)     | Auto-dismiss after N ms. `0` keeps the toast until dismissed manually.                                                                                            |
| `dismissible` | `boolean`                                                     | `true`                                  | When `true`, enables user dismissal affordances: X button, Escape, and swipe. Programmatic dismissal, overflow, and action default-dismiss still work when false. |
| `id`          | `string`                                                      | `cinder-toast-${n}` (auto-incrementing) | Pass a stable id to deduplicate — calling `show` again with the same id replaces the existing toast instead of stacking a duplicate.                              |
| `icon`        | `Snippet`                                                     | —                                       | Renders a decorative leading icon before the message. The icon is `aria-hidden`; keep the status meaning in the message text and variant.                         |
| `action`      | `{ label: string; onAction: () => void; keepOpen?: boolean }` | —                                       | Renders a button after the message. Clicking invokes `onAction` then dismisses the toast unless `keepOpen` is `true` (defaults to `false`).                       |

## Variant routing (polite vs assertive)

`variant` is not just a visual prop — it picks which live region the toast announces through. Polite variants (`info`, `success`) queue behind the user's current screen-reader focus; assertive variants (`warning`, `danger`) interrupt. See the [Two regions, two priorities](./toast-region.a11y.md#two-regions-two-priorities) table in the a11y doc for the exact ARIA mapping.

`maxStack` applies _per stack_: a region can hold up to `maxStack` polite toasts **and** `maxStack` assertive toasts simultaneously.

> [!TIP]
> Match urgency to variant. `success` ("Saved") is informational and belongs on the polite stack. `danger` ("Failed to save") interrupts because the user needs to know _now_. Reserve `warning` for conditions the user must address before continuing — session expiry, unsaved-changes risk — not ambient status updates; if no action is required, `info` is more honest.

## `show()` return value

`show()` returns a `string` — the assigned toast id. Capture it to enable targeted dismiss:

```ts
const id = toast.show('Saving…', { duration: 0 });
// …later, when the operation completes:
toast.dismiss(id);
```

Auto-generated ids (`cinder-toast-N`) are instance-local: stable for the lifetime of the mounted region and reset when it unmounts. Use them transiently within the current session, or pass a stable `options.id` when you need cross-render deduplication.

## Promise toasts

Use `toast.promise()` when one operation needs a sticky loading notification that turns into success or error output.

```ts
toast.promise(saveSettings(), {
  id: 'settings-save',
  loading: 'Saving settings...',
  success: 'Settings saved.',
  error: (error) => (error instanceof Error ? error.message : 'Save failed.'),
});
```

The loading phase is sticky and polite. Success stays polite; errors move to the assertive `danger` channel. If the loading toast is dismissed or replaced before the promise settles, the late settlement is ignored.

## Decorative icons

Pass `icon` to show a leading visual marker next to the message. The icon is decorative (`aria-hidden="true"`), so do not rely on it as the only status signal.

```svelte
{#snippet savedIcon()}
  <CheckIcon />
{/snippet}
```

```ts
toast.show('Settings saved.', {
  variant: 'success',
  icon: savedIcon,
});
```

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

> [!WARNING]
> For destructive-action undo flows (`'Item moved to trash.'` → `Undo`), set `dismissible: false`. With the default `dismissible: true`, the user can close the toast via the X button without ever firing `onAction` — and the destructive operation stays committed. Forcing dismissal through the action button (or auto-dismiss after `duration`) keeps the undo path explicit.

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

> [!WARNING]
> Don't dispatch to the _outer_ region from inside a modal. Toasts from the modal-scoped region render inside the modal's DOM subtree, so their action and dismiss buttons participate in the modal's focus trap as expected. Toasts dispatched to an app-root region from inside a modal render _outside_ the trap — keyboard users can't reach the dismiss or action buttons until the modal closes. Keep modal-originated toasts on the modal-scoped region.

## Dismiss patterns

There are six ways a toast leaves the screen:

- **User-driven** via the X button (when `dismissible: true`, the default).
- **Keyboard-driven** via Escape while focus is inside a dismissible toast.
- **Gesture-driven** via horizontal swipe when `dismissible: true`.
- **Auto-dismiss** after `duration` ms (when `duration > 0`).
- **Targeted programmatic** via `toast.dismiss(id)`. No-op if the id is not active.
- **Clear-all** via `toast.dismissAll()`. Clears polite **and** assertive stacks together.

```ts
toast.dismiss(id); // remove a specific toast
toast.dismissAll(); // clear everything in this region
```

Hovering or focusing the region pauses active auto-dismiss timers. Timers resume when both pointer and focus leave, so keyboard users can reach action and dismiss buttons without the toast expiring mid-interaction.

## Feature coverage

| Feature                 | Status                                                                                         |
| ----------------------- | ---------------------------------------------------------------------------------------------- |
| Stacked toasts          | Present: each live-region channel keeps its own bounded stack.                                 |
| Stagger / offset        | Present: stack index is exposed as `--cinder-toast-stack-index` for visual depth.              |
| Swipe-to-dismiss        | Present for pointer input when `dismissible` is true.                                          |
| Action button           | Present via `ToastOptions.action`; default dismisses after action.                             |
| Pause-on-hover/focus    | Present across the whole region.                                                               |
| Position variants       | Present via `position` prop, six viewport anchors.                                             |
| Promise/loading variant | Present via `toast.promise()`, with late-settlement guards.                                    |
| ARIA live regions       | Present and preserved as split polite/assertive channels.                                      |
| Keyboard dismiss        | Present via Escape for dismissible toasts.                                                     |
| Focus return            | Present for focused user dismissals; focus moves to the next toast control or `document.body`. |
