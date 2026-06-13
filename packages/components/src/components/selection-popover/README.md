# SelectionPopover

A floating toolbar that appears near a text selection and offers a comment-on-selection action with an inline composer. The component uses fixed-position Floating UI geometry, so the supplied selection anchor can flip or shift when it is near a viewport edge.

## When to use

Use `SelectionPopover` when you want readers to annotate or comment on a highlighted range of text — for example, in a document editor, review tool, or article surface. It is designed specifically for selection-scoped actions. For generic floating content or popovers unrelated to text selection, use the `Popover` component instead.

`SelectionPopover` does not render persistent comment highlights. Keep saved comment anchors in your own markup, or use `ReviewEditor` and the commentary anchoring utilities when you need editor-backed anchor tracking.

## How it positions

The `position` prop accepts a **viewport-relative anchor point** — the same coordinate space returned by `Range.getClientRects()` and `Range.getBoundingClientRect()`. A typical consumer computes the anchor from the selected range and passes it directly:

```ts
const range = selection.getRangeAt(0);
const rect =
  Array.from(range.getClientRects()).find((clientRect) => {
    return clientRect.width > 0 && clientRect.height > 0;
  }) ?? range.getBoundingClientRect();
position = { x: rect.left + rect.width / 2, y: rect.top, height: rect.height };
```

The component treats that point as a Floating UI virtual anchor, not as the panel's top-left corner. It prefers an above-selection placement, but shifts or flips near viewport edges. Coordinates are **not** relative to a containing element — do not pass offsetLeft/offsetTop or any container-relative value.

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
      const rect =
        Array.from(range.getClientRects()).find((clientRect) => {
          return clientRect.width > 0 && clientRect.height > 0;
        }) ?? range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        isOpen = false;
        position = null;
        return;
      }
      position = { x: rect.left + rect.width / 2, y: rect.top, height: rect.height };
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

| Prop              | Type       | Required | Default | Description                                                                                                                          |
| ----------------- | ---------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `class`           | `string`   | no       | —       | Additional class names merged with `.cinder-selection-popover`.                                                                      |
| `id`              | `string`   | yes      | —       | Unique identifier for the popover.                                                                                                   |
| `open`            | `boolean`  | no       | —       | Whether the popover is visible.                                                                                                      |
| `oncancel`        | `(opaque)` | no       | —       | Called when the composer is canceled. Not expressible in JSON Schema; see the component types for the signature.                     |
| `onclose`         | `(opaque)` | no       | —       | Called when the popover should close. Not expressible in JSON Schema; see the component types for the signature.                     |
| `oncommentsubmit` | `(opaque)` | no       | —       | Called when a comment is submitted. Not expressible in JSON Schema; see the component types for the signature.                       |
| `onexpand`        | `(opaque)` | no       | —       | Called when the compact action expands into the composer. Not expressible in JSON Schema; see the component types for the signature. |
| `position`        | `(opaque)` | yes      | —       | Viewport-relative anchor point for the popover. Not expressible in JSON Schema; see the component types for the signature.           |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
