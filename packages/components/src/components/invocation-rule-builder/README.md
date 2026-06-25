# InvocationRuleBuilder

A presentation component for building and reviewing conditional automation rules. Each rule is composed of one or more conditions (field / operator / value) and one or more actions (a target agent or service). Cinder renders the UI and reports every edit through a callback — it owns no rule execution, persistence, or validation semantics.

## Ownership boundary

Cinder does not execute, validate, or persist rules. The consumer provides the complete rule model through the `rules` prop and handles every change emitted by `onchange`. Cinder is responsible only for rendering the controls with correct accessible names and emitting pure (non-mutating) change descriptors.

## Usage

```svelte
<script lang="ts">
  import { InvocationRuleBuilder } from '@lostgradient/cinder/invocation-rule-builder';
  import type {
    InvocationRule,
    InvocationRuleChange,
    InvocationRuleOption,
  } from '@lostgradient/cinder/invocation-rule-builder';

  let rules = $state<InvocationRule[]>([]);

  const fieldOptions: InvocationRuleOption[] = [
    { value: 'path', label: 'Path' },
    { value: 'label', label: 'Label' },
    { value: 'author', label: 'Author' },
  ];

  const operatorOptions: InvocationRuleOption[] = [
    { value: 'matches', label: 'matches' },
    { value: 'is', label: 'is' },
    { value: 'is-not', label: 'is not' },
  ];

  const actionOptions: InvocationRuleOption[] = [
    { value: 'security-review', label: 'Security Review Agent' },
    { value: 'code-review', label: 'Code Review Agent' },
  ];

  function handleChange(nextRules: InvocationRule[], change: InvocationRuleChange): void {
    rules = nextRules;
    // Persist or validate here — cinder does not do this for you.
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
```

## Data model

```ts
type InvocationRule = {
  id: string;
  label: string;
  conditions: InvocationRuleCondition[];
  actions: InvocationRuleAction[];
};

type InvocationRuleCondition = {
  id: string;
  field: string; // consumer-defined, e.g. "path"
  operator: string; // consumer-defined, e.g. "matches"
  value: string; // consumer-defined, e.g. "src/**"
};

type InvocationRuleAction = {
  id: string;
  target: string; // consumer-defined, e.g. "security-review"
};
```

A rule fires when ALL of its conditions match (implicit AND). Boolean grouping, OR logic, and nested condition trees are out of scope for this component.

## Modes

Pass `readonly={true}` to render a read-only summary instead of editable controls. This is useful for review screens where the rule is being confirmed before saving.

## Props

<!-- generated:props:start -->

| Prop                | Type                                                                                                                                                                     | Required | Default | Description                                                                                                                                                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `actionOptions`     | { label: `string`; value: `string` }[]                                                                                                                                   | yes      | —       | Options for the action target selector. Consumer-provided list of targets, e.g. review-agent slugs or step identifiers.                                                                                                                             |
| `addActionLabel`    | `string`                                                                                                                                                                 | no       | —       | Label for the "Add action" button. Defaults to "Add action".                                                                                                                                                                                        |
| `addConditionLabel` | `string`                                                                                                                                                                 | no       | —       | Label for the "Add condition" button. Defaults to "Add condition".                                                                                                                                                                                  |
| `addRuleLabel`      | `string`                                                                                                                                                                 | no       | —       | Label for the "Add rule" button. Defaults to "Add rule".                                                                                                                                                                                            |
| `class`             | `string`                                                                                                                                                                 | no       | —       | Additional CSS classes applied to the root element.                                                                                                                                                                                                 |
| `fieldOptions`      | { label: `string`; value: `string` }[]                                                                                                                                   | yes      | —       | Options for the condition field selector. Consumer-provided list of fields that a condition can test, e.g. "path", "label", "author".                                                                                                               |
| `label`             | `string`                                                                                                                                                                 | no       | —       | Accessible label for the entire rule builder region.                                                                                                                                                                                                |
| `operatorOptions`   | { label: `string`; value: `string` }[]                                                                                                                                   | yes      | —       | Options for the condition operator selector. Consumer-provided list of operators, e.g. "matches", "is", "is-not", "contains".                                                                                                                       |
| `readonly`          | `boolean`                                                                                                                                                                | no       | —       | When true, renders a readonly summary of each rule instead of editable controls. Default is false (editable mode).                                                                                                                                  |
| `rules`             | { actions: { id: `string`; target: `string` }[]; conditions: { field: `string`; id: `string`; operator: `string`; value: `string` }[]; id: `string`; label: `string` }[] | yes      | —       | The current list of automation rules. Controlled — pass the updated list returned from `onchange` back into this prop to commit a change.                                                                                                           |
| `onchange`          | `(opaque)`                                                                                                                                                               | yes      | —       | Called whenever the user makes any edit. Receives the next rule array (pure, not mutated) and a change descriptor. Consumer owns persistence, validation, and execution. Not expressible in JSON Schema; see the component types for the signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->

## Accessibility

Each condition's field selector, operator selector, value input, and remove button carry accessible labels that identify which condition and rule they belong to (e.g. "Field for condition 2 of Rule 1"). Each action's target selector and remove button are similarly labeled. Rule reorder buttons are labeled "Move Rule 1 up" and "Move Rule 1 down". Add buttons describe their destination rule. A live region announces add, remove, and move events to screen reader users.

In readonly mode all controls are replaced by visible text, so no interaction is possible and keyboard navigation follows the natural document order.

Focus management on remove: when a condition or action row is removed, focus moves to the preceding row's remove button, or to the "Add condition" / "Add action" button if the removed row was the last one.

The component uses semantic HTML: the root is a `section` with an `aria-label`, condition and action lists use `role="list"` with `aria-labelledby` pointing to the "Conditions" / "Actions" section heading, and each row uses `role="listitem"`.
