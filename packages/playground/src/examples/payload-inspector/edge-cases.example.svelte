<script lang="ts" module>
  export const title = 'Edge cases';
  export const description =
    'Demonstrates null, invalid JSON, and empty payload states in the inspector.';
</script>

<script lang="ts">
  import { Button } from '@lostgradient/cinder/button';
  import { PayloadInspector } from '@lostgradient/cinder/payload-inspector';

  type Scenario = 'empty' | 'null' | 'invalid-json' | 'truncated' | 'primitive';

  let scenario = $state<Scenario>('empty');

  const scenarios: Record<Scenario, { value?: unknown; truncated?: boolean; label: string }> = {
    empty: { value: undefined, label: 'No payload' },
    null: { value: null, label: 'Null value' },
    'invalid-json': { value: '{ not valid json at all', label: 'Invalid JSON string' },
    truncated: { value: { partial: 'data', more: '...' }, truncated: true, label: 'Truncated' },
    primitive: { value: 42, label: 'Number primitive' },
  };

  const current = $derived(scenarios[scenario]);
</script>

<div style="display: flex; flex-direction: column; gap: 1rem;">
  <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
    {#each Object.keys(scenarios) as key (key)}
      <Button
        variant={scenario === key ? 'primary' : 'secondary'}
        size="sm"
        onclick={() => (scenario = key as Scenario)}
      >
        {scenarios[key as Scenario].label}
      </Button>
    {/each}
  </div>

  <PayloadInspector
    value={current.value}
    truncated={current.truncated ?? false}
    meta={{ source: 'edge-case-demo' }}
  />
</div>
