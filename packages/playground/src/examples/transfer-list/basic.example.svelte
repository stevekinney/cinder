<script lang="ts" module>
  export const title = 'Permission assignment';
  export const description =
    'Move selected or all permissions between available and granted lists.';
</script>

<script lang="ts">
  import { TransferList } from '@lostgradient/cinder/transfer-list';

  const items = [
    { id: 'read', label: 'Read' },
    { id: 'write', label: 'Write' },
    { id: 'deploy', label: 'Deploy' },
    { id: 'billing', label: 'Billing', disabled: true },
  ];

  let value = $state(['read']);
</script>

<TransferList
  {items}
  bind:value
  leftLabel="Available permissions"
  rightLabel="Granted permissions"
/>

<p>Granted: {value.join(', ') || 'None'}</p>
