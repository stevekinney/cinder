<script lang="ts" module>
  export const title = 'Microphone permission gate';
  export const description =
    'Shows the capability gate in each state for a microphone permission request.';
</script>

<script lang="ts">
  import { Button } from '@lostgradient/cinder/button';
  import { CapabilityGate } from '@lostgradient/cinder/capability-gate';
  import type { CapabilityGateState } from '@lostgradient/cinder/capability-gate';

  let capabilityState = $state<CapabilityGateState>('permission-needed');
  const needsAction = $derived(capabilityState === 'permission-needed');

  const states: CapabilityGateState[] = [
    'supported',
    'unsupported',
    'permission-needed',
    'permission-denied',
    'loading',
    'unavailable',
  ];
</script>

<div style="display: flex; flex-direction: column; gap: 1rem; max-width: 28rem;">
  {#if needsAction}
    <CapabilityGate
      feature="Microphone"
      state={capabilityState}
      primaryAction="Allow microphone"
      onPrimaryAction={() => {
        capabilityState = 'supported';
      }}
      fallbackAction="Use text instead"
      onFallbackAction={() => {
        capabilityState = 'unsupported';
      }}
    >
      <p style="font-size: 0.875rem; color: var(--cinder-text-muted); margin: 0;">
        Microphone access is needed for voice input. Your audio is never stored or shared.
      </p>
    </CapabilityGate>
  {:else}
    <CapabilityGate feature="Microphone" state={capabilityState} />
  {/if}

  <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
    {#each states as s (s)}
      <Button
        size="sm"
        variant={capabilityState === s ? 'secondary' : 'ghost'}
        onclick={() => {
          capabilityState = s;
        }}
      >
        {s}
      </Button>
    {/each}
  </div>
</div>
