# SelectionPopover

A floating toolbar that appears above a text selection and offers a comment-on-selection action with an inline composer. The component renders as a native `popover="manual"` element positioned with `position: fixed`, placing it in the browser's top layer above all other content.

## When to use

Use `SelectionPopover` when you want readers to annotate or comment on a highlighted range of text — for example, in a document editor, review tool, or article surface. It is designed specifically for selection-scoped actions. For generic floating content or popovers unrelated to text selection, use the `Popover` component instead.

## How it positions

The `position` prop accepts **viewport-relative** coordinates — the same coordinate space returned by `Range.getBoundingClientRect()`. A typical consumer computes the anchor from the selected range and passes it directly:

```ts
const range = selection.getRangeAt(0);
const rect = range.getBoundingClientRect();
position = { x: rect.left + rect.width / 2, y: rect.top };
```

The component clamps the rendered position to a 16px viewport margin automatically, so you do not need to guard against selections near the edges of the screen. Coordinates are **not** relative to a containing element — do not pass offsetLeft/offsetTop or any container-relative value.

## Usage

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import type { SelectionPopoverPosition } from '@lostgradient/cinder/selection-popover';
  import { SelectionPopover } from '@lostgradient/cinder/selection-popover';

  type Comment = { id: string; body: string };

  let isOpen = $state(false);
  let position = $state<SelectionPopoverPosition | null>(null);
  let comments = $state<Comment[]>([]);

  /**
   * Bound reference to the text surface element.
   * `selectionchange` is a document-level event — the handler uses this
   * reference to scope detection to selections inside the surface only.
   */
  let surfaceElement = $state<HTMLElement | null>(null);

  onMount(() => {
    function handleSelectionChange(): void {
      if (!surfaceElement) return;
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
        isOpen = false;
        position = null;
        return;
      }
      const range = selection.getRangeAt(0);
      if (!surfaceElement.contains(range.commonAncestorContainer)) {
        isOpen = false;
        position = null;
        return;
      }
      const rect = range.getBoundingClientRect();
      position = { x: rect.left + rect.width / 2, y: rect.top };
      isOpen = true;
    }

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  });

  function handleClose(): void {
    isOpen = false;
    position = null;
  }

  function handleCommentSubmit(body: string): void {
    comments = [...comments, { id: crypto.randomUUID(), body }];
    handleClose();
  }
</script>

<article bind:this={surfaceElement}>
  <p>Select text in this paragraph to comment on it.</p>
</article>

<SelectionPopover
  id="my-selection-popover"
  open={isOpen}
  {position}
  onclose={handleClose}
  oncommentsubmit={handleCommentSubmit}
/>
```

## Props

<!-- generated:props:start -->

| Prop              | Type       | Required | Default | Description                                                                                                                |
| ----------------- | ---------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------- |
| `class`           | `string`   | no       | —       | Additional class names merged with `.cinder-selection-popover`.                                                            |
| `id`              | `string`   | yes      | —       | Unique identifier for the popover.                                                                                         |
| `open`            | `boolean`  | no       | —       | Whether the popover is visible.                                                                                            |
| `oncancel`        | `(opaque)` | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `onclose`         | `(opaque)` | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `oncommentsubmit` | `(opaque)` | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `onexpand`        | `(opaque)` | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `position`        | `(opaque)` | no       | —       | A prop whose shape is not captured by the JSON schema; see the component types for the exact signature.                    |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
