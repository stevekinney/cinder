<script lang="ts" module>
  export const title = 'Toggled by an external trigger';
  export const description =
    'A button outside the popover drives open. When the consumer clicks outside the popover, the component invokes onclose and the consumer flips open back to false.';
</script>

<script lang="ts">
  import { Button } from 'cinder/button';
  import { SelectionPopover } from 'cinder/selection-popover';

  const popoverId = 'toggled-selection-popover';
  let isOpen = $state(false);
  let lastSubmitted = $state<string | null>(null);

  function toggle(): void {
    isOpen = !isOpen;
  }

  function handleClose(): void {
    isOpen = false;
  }

  function handleSubmit(body: string): void {
    lastSubmitted = body;
    isOpen = false;
  }
</script>

<div style="max-width: 36rem;">
  <p style="margin: 0 0 0.75rem; line-height: 1.5;">
    Click the button to open the popover at a fixed viewport position. Click anywhere outside the
    popover and it closes — the component fires <code>onclose</code> and the consumer flips
    <code>open</code> back to <code>false</code>. The <code>position</code> prop here uses
    hard-coded viewport-relative coordinates for demonstration; a real consumer would derive them
    from <code>Range.getBoundingClientRect()</code>.
  </p>

  <Button
    label={isOpen ? 'Hide popover' : 'Show popover'}
    aria-expanded={isOpen}
    aria-controls={popoverId}
    onclick={toggle}
  />
</div>

<SelectionPopover
  id={popoverId}
  open={isOpen}
  position={{ x: 260, y: 260 }}
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
