<script lang="ts">
  import { ConnectionIndicator, Toggle, Tooltip } from '@lostgradient/cinder';
  import { useQueryClient } from '@tanstack/svelte-query';

  import { getFleetEventSource } from '../../app/engine-status.svelte.ts';
  import { getPrincipalStore, scopeGate } from '../../lib/scopes.svelte.ts';
  import { invalidateWorkerSurfaceQueries } from './workers-data.ts';

  let { locked = false }: { locked?: boolean } = $props();
  const fleetSource = getFleetEventSource();
  const principalStore = getPrincipalStore();
  const queryClient = useQueryClient();
  let live = $state(false);
  const liveToggleGate = $derived(scopeGate(principalStore, ['events:read']));
  const workerLivenessKinds = new Set(['worker:connected', 'worker:disconnected']);

  // Observe the shell's shared connection; the route's polling remains active.
  $effect(() => {
    if (!live || liveToggleGate.disabled) return;
    return fleetSource.subscribe((frame) => {
      if (workerLivenessKinds.has(frame.kind)) invalidateWorkerSurfaceQueries(queryClient);
    });
  });
</script>

{#if !locked}
  <div class="weft-workers-route__live">
    {#if live}
      <ConnectionIndicator status={fleetSource.status} />
    {:else}
      <ConnectionIndicator status="polling" label="Updated every 30s" />
    {/if}
    {#if liveToggleGate.disabled}
      <Tooltip text={liveToggleGate.title ?? ''}>
        <Toggle id="workers-live" label="Live" checked={live} disabled />
      </Tooltip>
    {:else}
      <Toggle id="workers-live" label="Live" bind:checked={live} />
    {/if}
  </div>
{/if}
