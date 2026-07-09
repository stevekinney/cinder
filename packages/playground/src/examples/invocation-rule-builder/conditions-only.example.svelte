<script lang="ts" module>
  export const title = 'Conditions-only mode';
  export const description =
    'Build alert-filter conditions with typed value inputs and a fixed comparison-operator set — no action targets, for cases like saved searches or alert filters that have nothing to invoke.';
</script>

<script lang="ts">
  import {
    InvocationRuleBuilder,
    type InvocationRule,
    type InvocationRuleChange,
    type InvocationRuleOption,
  } from '@lostgradient/cinder/invocation-rule-builder';

  const fieldOptions: InvocationRuleOption[] = [
    { value: 'retry-count', label: 'Retry count', type: 'number' },
    { value: 'is-flaky', label: 'Flaky', type: 'boolean' },
    {
      value: 'severity',
      label: 'Severity',
      type: 'enum',
      options: [
        { value: 'low', label: 'Low' },
        { value: 'medium', label: 'Medium' },
        { value: 'high', label: 'High' },
      ],
    },
    { value: 'owner', label: 'Owner' },
  ];

  let rules = $state<InvocationRule[]>([
    {
      id: 'rule-flaky-high-severity',
      label: 'Flaky high-severity retries',
      conditions: [
        { id: 'c1', field: 'is-flaky', operator: 'eq', value: 'true' },
        { id: 'c2', field: 'severity', operator: 'eq', value: 'high' },
        { id: 'c3', field: 'retry-count', operator: 'gte', value: '3' },
      ],
      actions: [],
    },
  ]);

  function handleChange(nextRules: InvocationRule[], _change: InvocationRuleChange): void {
    rules = nextRules;
  }
</script>

<InvocationRuleBuilder
  {rules}
  onchange={handleChange}
  {fieldOptions}
  mode="conditions"
  label="Alert filter conditions"
/>
