<script lang="ts" module>
  export const title = 'Readonly rule summary';
  export const description =
    'Display configured automation rules in a non-editable summary view, suitable for review or confirmation screens.';
</script>

<script lang="ts">
  import {
    InvocationRuleBuilder,
    type InvocationRule,
    type InvocationRuleOption,
  } from '@lostgradient/cinder/invocation-rule-builder';

  const fieldOptions: InvocationRuleOption[] = [
    { value: 'path', label: 'Path' },
    { value: 'label', label: 'Label' },
    { value: 'author-role', label: 'Author role' },
    { value: 'event-type', label: 'Event type' },
  ];

  const operatorOptions: InvocationRuleOption[] = [
    { value: 'matches', label: 'matches' },
    { value: 'is', label: 'is' },
    { value: 'is-not', label: 'is not' },
    { value: 'contains', label: 'contains' },
  ];

  const actionOptions: InvocationRuleOption[] = [
    { value: 'security-reviewer', label: 'Security Reviewer' },
    { value: 'code-quality', label: 'Code Quality Agent' },
    { value: 'dependency-audit', label: 'Dependency Audit' },
  ];

  const rules: InvocationRule[] = [
    {
      id: 'rule-security',
      label: 'Security review for sensitive paths',
      conditions: [
        { id: 'c1', field: 'path', operator: 'matches', value: 'src/auth/**' },
        { id: 'c2', field: 'label', operator: 'is', value: 'security' },
      ],
      actions: [{ id: 'a1', target: 'security-reviewer' }],
    },
    {
      id: 'rule-deps',
      label: 'Dependency audit',
      conditions: [{ id: 'c3', field: 'path', operator: 'matches', value: 'package.json' }],
      actions: [{ id: 'a2', target: 'dependency-audit' }],
    },
    {
      id: 'rule-empty',
      label: 'Catch-all rule',
      conditions: [],
      actions: [{ id: 'a3', target: 'code-quality' }],
    },
  ];
</script>

<InvocationRuleBuilder
  {rules}
  onchange={() => {}}
  {fieldOptions}
  {operatorOptions}
  {actionOptions}
  readonly
  label="Configured PR routing rules (readonly)"
/>
