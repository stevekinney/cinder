<script lang="ts" module>
  export const title = 'Session row with independent actions';
  export const description =
    'The full main body opens the session while Rename and Temporal Web remain sibling actions with their own Tab stops.';
</script>

<script lang="ts">
  import Button from '@lostgradient/cinder/button';
  import SelectableRow from '@lostgradient/cinder/selectable-row';

  let opened = $state(0);
  let renamed = $state(0);
</script>

<div style="display: grid; gap: var(--cinder-space-3); max-inline-size: 48rem;">
  <SelectableRow
    selected
    onclick={() => {
      opened += 1;
    }}
  >
    {#snippet leading()}<span aria-hidden="true">●</span>{/snippet}
    {#snippet title()}
      Customer onboarding workflow investigation with a deliberately long session title
    {/snippet}
    {#snippet description()}Inspect the active workflow execution and event history.{/snippet}
    {#snippet meta()}Running · Updated 2 minutes ago{/snippet}
    {#snippet trailingActions()}
      <Button
        size="sm"
        onclick={() => {
          renamed += 1;
        }}>Rename</Button
      >
      <Button
        size="sm"
        href="https://example.com/temporal/session"
        target="_blank"
        rel="noopener noreferrer">Temporal Web</Button
      >
    {/snippet}
  </SelectableRow>

  <output data-testid="selectable-row-activation-counts">
    Opened {opened} times; renamed {renamed} times.
  </output>
</div>
