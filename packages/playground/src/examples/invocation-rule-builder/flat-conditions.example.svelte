<script lang="ts" module>
  export const title = 'Flat AND-only conditions';
  export const description =
    'Edit one controlled conditions array directly, without rule names, ordering, actions, or a way to add another group.';
</script>

<script lang="ts">
  import {
    InvocationRuleBuilder,
    type InvocationRuleCondition,
    type InvocationRuleConditionChange,
    type InvocationRuleOption,
  } from '@lostgradient/cinder/invocation-rule-builder';

  const fieldOptions: InvocationRuleOption[] = [
    {
      value: 'status',
      label: 'Status',
      type: 'enum',
      options: [
        { value: 'running', label: 'Running' },
        { value: 'failed', label: 'Failed' },
      ],
    },
    { value: 'retry-count', label: 'Retry count', type: 'number' },
  ];

  let conditions = $state<InvocationRuleCondition[]>([
    { id: 'status', field: 'status', operator: 'eq', value: 'failed' },
    { id: 'retries', field: 'retry-count', operator: 'gte', value: '3' },
  ]);

  function handleChange(
    nextConditions: InvocationRuleCondition[],
    _change: InvocationRuleConditionChange,
  ): void {
    conditions = nextConditions;
  }
</script>

<InvocationRuleBuilder
  mode="flat-conditions"
  {conditions}
  onchange={handleChange}
  {fieldOptions}
  label="Workflow filters"
/>
