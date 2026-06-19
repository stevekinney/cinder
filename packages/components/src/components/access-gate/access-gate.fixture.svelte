<script lang="ts">
  import { Button } from '../button/index.ts';

  import { AccessGate } from './index.ts';

  type Props = {
    variant?: 'inline' | 'section';
  };

  let { variant = 'inline' }: Props = $props();
</script>

{#if variant === 'section'}
  <AccessGate
    granted={false}
    variant="section"
    reason="Requires scope: storage:admin"
    requirement="storage:admin"
  />
{:else}
  <AccessGate granted={false} reason="Requires scope: workflows:cancel">
    <Button label="Cancel workflow" variant="danger" />
  </AccessGate>
{/if}
