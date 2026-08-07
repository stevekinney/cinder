# Drawer

Edge-anchored overlay panel for supplementary content without leaving the current page. The `placement` prop picks the edge: `left`, `right` (default), or `bottom` for mobile-style bottom sheets.

## Choosing this component

- Showing detail or edit forms alongside a list or table where the user needs to stay in context.
- Navigation trees, filter panels, or settings that the user may want to keep open while interacting with the page.
- Secondary workflows that complement the current view rather than replacing it.
- Mobile-first surfaces that should slide up from the bottom of the viewport — use `placement="bottom"`, optionally with `dragHandleVisible`.

## Choosing something else

- Full-screen workflows that require the user's full attention — use a [`Modal`](../modal/README.md) or navigate to a new page.
- Brief contextual explanations or single-action prompts — use a [`Popover`](../popover/README.md) instead.

## Related components

- [`Modal`](../modal/README.md) — blocking full-attention overlay when the user cannot continue without acting.
- [`Sidebar`](../sidebar/README.md) — persistent side panel that is always visible (not overlaid).

## Usage

```svelte
<script lang="ts">
  import Button from '@lostgradient/cinder/button';
  import Checkbox from '@lostgradient/cinder/checkbox';
  import Drawer from '@lostgradient/cinder/drawer';

  let open = $state(false);
  let triggerRef: HTMLElement | null = $state(null);

  const filters = Array.from({ length: 30 }, (_, index) => ({
    id: `drawer-overflowing-filter-${index + 1}`,
    label: `Filter group ${index + 1}`,
  }));
</script>

<Button
  label="Open drawer"
  onclick={(event: MouseEvent) => {
    triggerRef = event.currentTarget as HTMLElement;
    open = true;
  }}
/>

<Drawer bind:open title="Filters" {triggerRef}>
  <div style="display: grid; gap: 0.75rem;">
    {#each filters as filter (filter.id)}
      <Checkbox id={filter.id} label={filter.label} />
    {/each}
  </div>

  {#snippet footer()}
    <Button variant="secondary" label="Cancel" onclick={() => (open = false)} />
    <Button label="Apply" onclick={() => (open = false)} />
  {/snippet}
</Drawer>
```

## Props

<!-- generated:props:start -->

| Prop                | Type                                 | Required | Default | Description                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------- | ------------------------------------ | -------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ariaLabelledBy`    | `string`                             | no       | —       | Optional id of an element that names the drawer. When supplied, drawer wires `aria-labelledby` to this id and renders no internal heading. Use this when a custom `header` snippet has its own visible heading — supply `ariaLabelledBy` pointing to that heading's id so the visible and accessible names stay in sync.                                                                            |
| `class`             | `string`                             | no       | —       | Additional class names merged with `.cinder-drawer`.                                                                                                                                                                                                                                                                                                                                                |
| `dragHandleVisible` | `boolean`                            | no       | —       | When `true` and `placement="bottom"`, render a decorative drag handle above the header. Swipe-to-close gesture is a stretch goal not implemented in MVP — the handle is purely a visual affordance. Ignored for `left`/`right` placements. Default `false`. Named `dragHandleVisible` (not `draggable`) to avoid colliding with the native HTML `draggable` attribute on the underlying `<dialog>`. |
| `open`              | `boolean`                            | no       | —       | Whether the drawer is open. Bindable via `bind:open`.                                                                                                                                                                                                                                                                                                                                               |
| `placement`         | `"left"` \| `"right"` \| `"bottom"`  | no       | —       | Edge the drawer slides in from. Default `right`.                                                                                                                                                                                                                                                                                                                                                    |
| `size`              | `"sm"` \| `"md"` \| `"lg"` \| `"xl"` | no       | —       | Drawer width token for `left`/`right` placements. Default `md`. Ignored for `placement="bottom"`, which always spans the full viewport width and caps its height at 90dvh.                                                                                                                                                                                                                          |
| `title`             | `string`                             | yes      | —       | Accessible name for the drawer. Required for screen-reader labelling. Rendered as a visible `<h2>` in the default header. When a custom `header` snippet is provided without `ariaLabelledBy`, this text is rendered in a visually-hidden `<h2>` as the accessible name fallback.                                                                                                                   |
| `children`          | `(opaque)`                           | yes      | —       | Drawer body content. Required. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                                                                           |
| `footer`            | `(opaque)`                           | no       | —       | Optional footer (e.g. action buttons). Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                                                                   |
| `header`            | `(opaque)`                           | no       | —       | Custom header. Falls back to a default header that renders `title`. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                                      |
| `triggerRef`        | `(opaque)`                           | no       | —       | Optional reference to the element that opened the drawer. When supplied, focus returns to this element on close. When omitted, focus restores to the element that held focus before the drawer opened. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                   |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
