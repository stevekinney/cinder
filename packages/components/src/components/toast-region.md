# ToastRegion

`<ToastRegion>` is a dual live-region container that manages toast notifications. It owns an independent queue—there is no process-global singleton—so multiple regions can coexist with separate stacks (one app-root, one modal-scoped, etc.). Dispatch toasts programmatically from any descendant via `useToast()`.

See also: [toast-region.a11y.md](./toast-region.a11y.md) for the full ARIA and live-region rationale.

## Placement

Mount one `<ToastRegion>` near the root of your app so every component can reach it via `useToast()`. In SvelteKit, that's typically `+layout.svelte`.

```svelte
<!-- +layout.svelte -->
<ToastRegion>
  {#snippet children()}
    {@render children()}
  {/snippet}
</ToastRegion>
```

Toasts dispatched before the region mounts are no-ops—`useToast()` would throw because no context exists yet. Multiple regions are legal and produce independent queues; each handles its own `maxStack` and `defaultDuration`.

## ToastRegion props

| Prop              | Type      | Default | Description                                                                                                                   |
| ----------------- | --------- | ------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `maxStack`        | `number`  | `5`     | Maximum simultaneous toasts per stack (polite and assertive each cap independently). Overflow drops the oldest.               |
| `defaultDuration` | `number`  | `5000`  | Auto-dismiss delay in milliseconds. `0` makes all toasts sticky by default. Overridable per-call via `ToastOptions.duration`. |
| `class`           | `string`  | —       | Additional class names merged onto `.cinder-toast-region`.                                                                    |
| `children`        | `Snippet` | —       | When supplied, descendants of this snippet can call `useToast()` to access the region's API.                                  |

## useToast()

```ts
import { useToast } from 'cinder';
```

Call `useToast()` during component initialization—Svelte's `getContext` runs at mount time, not inside event handlers. Inside a snippet body, use `{@const toast = useToast()}` at the top of the snippet.

If no `<ToastRegion>` is mounted above the caller, `useToast()` throws:

```
useToast() must be called inside a <ToastRegion />. Mount one in your root layout.
```

This is intentional, not a bug. The error surfaces misconfigured component trees at development time rather than silently dropping toasts.

There is no `cinder/use-toast` subpath export. Import from the root `cinder` barrel only.

## ToastOptions

| Field         | Type                                                          | Default                    | Description                                                                                                                      |
| ------------- | ------------------------------------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `variant`     | `'info' \| 'success' \| 'warning' \| 'danger'`                | `'info'`                   | Visual treatment and live-region routing (see [Variant routing](#variant-routing-polite-vs-assertive) below).                    |
| `duration`    | `number`                                                      | region's `defaultDuration` | Auto-dismiss after N ms. `0` keeps the toast until dismissed manually.                                                           |
| `dismissible` | `boolean`                                                     | `true`                     | When `true`, renders the dismiss (×) button.                                                                                     |
| `id`          | `string`                                                      | `cinder-toast-N` (auto)    | Stable id for deduplication—calling `show` again with the same active id replaces the existing toast instead of stacking a copy. |
| `action`      | `{ label: string; onAction: () => void; keepOpen?: boolean }` | —                          | Renders an inline button after the message. Clicking invokes `onAction` then dismisses the toast unless `keepOpen` is `true`.    |

## Variant routing (polite vs assertive)

The `variant` field does two things: it sets the visual style _and_ determines which live region receives the toast.

| Variants            | Live region | ARIA role | `aria-live` |
| ------------------- | ----------- | --------- | ----------- |
| `info`, `success`   | polite      | `status`  | `polite`    |
| `warning`, `danger` | assertive   | `alert`   | `assertive` |

The polite stack queues announcements behind the user's current screen-reader focus—informational, non-interrupting. The assertive stack interrupts immediately. `maxStack` caps each stack independently: a region can hold up to `maxStack` polite toasts _and_ `maxStack` assertive toasts simultaneously.

See [toast-region.a11y.md](./toast-region.a11y.md) for the full ARIA rationale and WCAG citation.

## show() return value

`show()` returns a `string`—the assigned toast id. Capture it to enable targeted dismiss:

```ts
const id = toast.show('Saving…', { duration: 0 });
// …later, when the save completes
toast.dismiss(id);
```

Auto-generated ids (`cinder-toast-N`) are not stable across reloads—only use them transiently within the current session.

## Action buttons

The `action` option renders a focusable button after the toast message:

```ts
toast.show('File ready.', {
  variant: 'success',
  duration: 0,
  action: {
    label: 'Download',
    onAction: () => startDownload(),
  },
});
```

By default, clicking the action button invokes `onAction` and dismisses the toast. Pass `keepOpen: true` to keep the toast visible after the action fires—useful for progress toasts where the action opens a side panel and the toast should remain until the operation completes.

The button is a real focusable element inside the live region; keyboard users can Tab to it after the toast is announced. See [toast-region.a11y.md § Action button](./toast-region.a11y.md) for screen-reader behavior.

## Modal-scoped regions via children

`<ToastRegion>` can wrap content via the `children` snippet. Nesting a region inside a modal scopes its toasts to that modal's lifecycle—when the modal unmounts, all pending timers are cleared and the queue is torn down.

```svelte
<Modal bind:open title="Upload">
  {#snippet children()}
    <ToastRegion>
      {#snippet children()}
        {@const toast = useToast()}
        <!-- form content — useToast() here gets the modal-scoped API -->
        <UploadForm {toast} />
      {/snippet}
    </ToastRegion>
  {/snippet}
</Modal>
```

`useToast()` inside the snippet returns the nearest enclosing region's API—the modal-scoped one, not any outer app-root region. The two queues are completely independent.

## Dismiss patterns

Three ways a toast can be dismissed:

- **User-driven**: via the × button when `dismissible: true` (the default).
- **Auto-dismiss**: after `duration` ms when `duration > 0`.
- **Programmatic**: `toast.dismiss(id)` removes a specific toast by id; `toast.dismissAll()` clears both the polite and assertive stacks together. `dismiss(id)` is a no-op if the id is not currently active.

## Accessibility

See [toast-region.a11y.md](./toast-region.a11y.md) for the complete ARIA / live-region / reduced-motion documentation.

## v1 limitations

- Toasts dispatched before `<ToastRegion>` mounts are no-ops—`useToast()` would throw because no context exists yet.
- No process-global singleton—region-scoped only. Every `useToast()` call must have an enclosing region.
- No position/placement prop yet; the region renders at its CSS-defined default position.
- `maxStack` applies per stack (polite and assertive each cap independently), not as a combined total.
- `id` deduplication is exact-match string equality—no fuzzy matching.
