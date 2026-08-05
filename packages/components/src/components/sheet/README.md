# Sheet

Bottom-anchored overlay panel optimised for mobile-style drawer interactions.

## Choosing this component

- Action sheets and option pickers on mobile or touch-first layouts where a bottom-up slide feels natural.
- Quick-select panels (share, sort, filter) that need to feel native on small screens.

## Choosing something else

- Desktop-first side panels — use [`Drawer`](../drawer/README.md) for left/right edge placement.
- Full-attention blocking dialogs — use [`Modal`](../modal/README.md) when the user must act before continuing.

## Related components

- [`Drawer`](../drawer/README.md) — side-anchored overlay for desktop-first supplementary content.
- [`Modal`](../modal/README.md) — blocking full-attention overlay.

## Usage

```svelte
<script lang="ts">
  import Button from '@lostgradient/cinder/button';
  import Sheet from '@lostgradient/cinder/sheet';

  let open = $state(false);
  let triggerRef: HTMLElement | null = $state(null);

  const actions = Array.from({ length: 14 }, (_, index) => ({
    id: `action-${index + 1}`,
    label: `Workspace action ${index + 1}`,
    description: 'Secondary action detail and short explanatory copy.',
  }));
</script>

<Button
  label="Open sheet"
  onclick={(event: MouseEvent) => {
    triggerRef = event.currentTarget as HTMLElement;
    open = true;
  }}
/>

<Sheet bind:open title="Workspace actions" {triggerRef} dragHandleVisible>
  <div style="display: grid; gap: 0.875rem;">
    {#each actions as action (action.id)}
      <section>
        <h3 style="margin: 0 0 0.25rem; font-size: var(--cinder-text-base);">
          {action.label}
        </h3>
        <p style="margin: 0; color: var(--cinder-text-muted);">{action.description}</p>
      </section>
    {/each}
  </div>

  {#snippet footer()}
    <Button label="Done" onclick={() => (open = false)} />
  {/snippet}
</Sheet>
```

## Props

<!-- generated:props:start -->

| Prop                | Type       | Required | Default | Description                                                                                                                                                                                                                                                                                                                         |
| ------------------- | ---------- | -------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ariaLabelledBy`    | `string`   | no       | —       | Optional id of an element that names the sheet. When supplied, sheet wires `aria-labelledby` to this id and renders no internal heading. Use this when a custom `header` snippet has its own visible heading — supply `ariaLabelledBy` pointing to that heading's id so the visible and accessible names stay in sync.              |
| `class`             | `string`   | no       | —       | Additional class names merged with `.cinder-sheet`.                                                                                                                                                                                                                                                                                 |
| `dragHandleVisible` | `boolean`  | no       | —       | When `true`, render a decorative drag handle above the header. Swipe-to-close gesture is a stretch goal not implemented in MVP — the handle is purely a visual affordance. Default `false`. Named `dragHandleVisible` (not `draggable`) to avoid colliding with the native HTML `draggable` attribute on the underlying `<dialog>`. |
| `open`              | `boolean`  | no       | —       | Whether the sheet is open. Bindable via `bind:open`.                                                                                                                                                                                                                                                                                |
| `title`             | `string`   | yes      | —       | Accessible name for the sheet. Required for screen-reader labelling. Rendered as a visible `<h2>` in the default header. When a custom `header` snippet is provided without `ariaLabelledBy`, this text is rendered in a visually-hidden `<h2>` as the accessible name fallback.                                                    |
| `children`          | `(opaque)` | yes      | —       | Sheet body content. Required. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                            |
| `footer`            | `(opaque)` | no       | —       | Optional footer (e.g. action buttons). Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                   |
| `header`            | `(opaque)` | no       | —       | Custom header. Falls back to a default header that renders `title`. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                      |
| `triggerRef`        | `(opaque)` | no       | —       | Optional reference to the element that opened the sheet. When supplied, focus returns to this element on close. When omitted, focus restores to the element that held focus before the sheet opened. Not expressible in JSON Schema; see the component types for the signature.                                                     |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
