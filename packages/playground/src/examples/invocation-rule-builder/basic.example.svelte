<script lang="ts" module>
  export const title = 'PR review routing rules';
  export const description =
    'Configure which code review agents run based on pull request conditions such as changed paths, labels, and author membership.';
</script>

<script lang="ts">
  import {
    InvocationRuleBuilder,
    type InvocationRule,
    type InvocationRuleChange,
    type InvocationRuleOption,
  } from '@lostgradient/cinder/invocation-rule-builder';

  const fieldOptions: InvocationRuleOption[] = [
    { value: 'path', label: 'Path' },
    { value: 'label', label: 'Label' },
    { value: 'author-role', label: 'Author role' },
    { value: 'event-type', label: 'Event type' },
    { value: 'check-status', label: 'Check status' },
  ];

  const operatorOptions: InvocationRuleOption[] = [
    { value: 'matches', label: 'matches' },
    { value: 'is', label: 'is' },
    { value: 'is-not', label: 'is not' },
    { value: 'contains', label: 'contains' },
    { value: 'failed', label: 'failed' },
  ];

  const actionOptions: InvocationRuleOption[] = [
    { value: 'security-reviewer', label: 'Security Reviewer' },
    { value: 'code-quality', label: 'Code Quality Agent' },
    { value: 'dependency-audit', label: 'Dependency Audit' },
    { value: 'performance-review', label: 'Performance Review' },
  ];

  let rules = $state<InvocationRule[]>([
    {
      id: 'rule-security',
      label: 'Security review for sensitive paths',
      conditions: [
        { id: 'c1', field: 'path', operator: 'matches', value: 'src/auth/**' },
        { id: 'c2', field: 'path', operator: 'matches', value: 'src/crypto/**' },
      ],
      actions: [{ id: 'a1', target: 'security-reviewer' }],
    },
    {
      id: 'rule-deps',
      label: 'Dependency changes',
      conditions: [{ id: 'c3', field: 'path', operator: 'matches', value: 'package.json' }],
      actions: [{ id: 'a2', target: 'dependency-audit' }],
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
  {operatorOptions}
  {actionOptions}
  label="PR routing rules"
/>
