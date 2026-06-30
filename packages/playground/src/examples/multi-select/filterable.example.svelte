<script lang="ts" module>
  export const title = 'Filterable with warning';
  export const description =
    'Enable filtering, warning helper text, and top-after-reopen selection feedback.';
</script>

<script lang="ts">
  import { MultiSelect } from '@lostgradient/cinder/multi-select';

  let { mountIdPrefix }: { mountIdPrefix?: string } = $props();
  const uid = $props.id();
  let fieldId = $derived(`${mountIdPrefix ?? uid}-teams`);

  const teams = [
    { id: 'design', label: 'Design', description: 'Product and visual design' },
    { id: 'engineering', label: 'Engineering', description: 'Frontend and backend' },
    { id: 'qa', label: 'QA', description: 'Testing and release checks' },
    { id: 'support', label: 'Support', description: 'Customer support and triage' },
    { id: 'ops', label: 'Operations', description: 'SRE and infrastructure' },
  ] as const;

  let selectedTeams = $state<Array<(typeof teams)[number]['id']>>(['engineering', 'qa']);
</script>

<MultiSelect
  id={fieldId}
  label="Teams"
  items={teams}
  filterable
  warning="Selections affect queue routing."
  selectionFeedback="top-after-reopen"
  bind:selectedIds={selectedTeams}
/>
