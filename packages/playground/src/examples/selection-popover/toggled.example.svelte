<script lang="ts" module>
  export const title = 'Toggled by an external trigger';
  export const description =
    'A button outside the popover drives open. When the consumer clicks outside the popover, the component invokes onclose and the consumer flips open back to false.';
</script>

<script lang="ts">
  import { Button } from '@lostgradient/cinder/button';
  import type { SelectionPopoverPosition } from '@lostgradient/cinder/selection-popover';
  import { SelectionPopover } from '@lostgradient/cinder/selection-popover';

  const popoverId = 'toggled-selection-popover';
  let isOpen = $state(false);
  let position = $state<SelectionPopoverPosition | null>(null);
  let lastSubmitted = $state<string | null>(null);
  let anchorElement = $state<HTMLElement | null>(null);

  function openPopover(): void {
    if (!anchorElement) return;

    const rect = anchorElement.getBoundingClientRect();
    position = {
      x: rect.left + rect.width / 2,
      y: rect.top,
      height: rect.height,
    };
    isOpen = true;
  }

  function handleClose(): void {
    isOpen = false;
    position = null;
  }

  function handleSubmit(body: string): void {
    lastSubmitted = body;
    handleClose();
  }
</script>

<div style="max-width: 36rem;">
  <p style="margin: 0 0 0.75rem; line-height: 1.5;">
    Click the button to open the popover at a visible marked phrase. Click anywhere outside the
    popover and it closes — the component fires <code>onclose</code> and the consumer flips
    <code>open</code> back to <code>false</code>. The <code>position</code> prop here is derived from
    the marked phrase's viewport rectangle.
  </p>

  <p style="margin: 0 0 0.75rem; line-height: 1.5;">
    The comment action anchors to
    <mark
      bind:this={anchorElement}
      data-testid="external-trigger-anchor"
      style="border-radius: var(--cinder-radius-sm); background: color-mix(in oklch, var(--cinder-accent), transparent 84%); color: var(--cinder-text); padding: 0 0.125rem;"
    >
      this visible phrase
    </mark>
    rather than a hard-coded viewport coordinate.
  </p>

  <Button
    label="Open popover"
    aria-expanded={isOpen}
    aria-controls={popoverId}
    disabled={isOpen}
    onclick={openPopover}
  />
</div>

<SelectionPopover
  id={popoverId}
  open={isOpen}
  {position}
  onclose={handleClose}
  oncommentsubmit={handleSubmit}
/>

{#if lastSubmitted}
  <section style="margin: 1rem 0 0;" aria-label="Last submitted">
    <h3
      style="margin: 0 0 0.5rem; font-size: var(--cinder-text-xs); font-weight: var(--cinder-font-medium); color: var(--cinder-text-muted); text-transform: uppercase; letter-spacing: 0.04em;"
    >
      Last submitted
    </h3>
    <article
      style="padding: 0.5rem 0.75rem; border: 1px solid var(--cinder-border-muted); border-radius: var(--cinder-radius-sm); background: var(--cinder-surface);"
    >
      {lastSubmitted}
    </article>
  </section>
{/if}
