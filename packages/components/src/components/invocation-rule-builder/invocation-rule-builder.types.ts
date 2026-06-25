import type { HTMLAttributes } from 'svelte/elements';

/**
 * A single condition within a rule. The field, operator, and value
 * are all consumer-defined strings — cinder does not interpret them.
 *
 * @schemaObject
 */
export type InvocationRuleCondition = {
  /** Identifies the condition row; must be unique within its rule. */
  id: string;
  /** The field being tested, e.g. "path" or "label". Consumer-defined. */
  field: string;
  /** The comparison operator, e.g. "matches" or "is". Consumer-defined. */
  operator: string;
  /** The value being compared against. Consumer-defined. */
  value: string;
};

/**
 * A single action within a rule. The target is a consumer-defined
 * identifier naming the agent, service, or step to invoke.
 *
 * @schemaObject
 */
export type InvocationRuleAction = {
  /** Identifies the action row; must be unique within its rule. */
  id: string;
  /** The action target, e.g. a review-agent slug. Consumer-defined. */
  target: string;
};

/**
 * A single automation rule. A rule fires when ALL of its conditions are
 * met and then triggers all of its actions. Cinder does not execute,
 * persist, or validate rules — consumers own that logic entirely.
 *
 * @schemaObject
 */
export type InvocationRule = {
  /** Unique identifier for the rule. */
  id: string;
  /** Display label for the rule. */
  label: string;
  /** Zero or more conditions (implicit AND). */
  conditions: InvocationRuleCondition[];
  /** Zero or more actions to invoke when conditions match. */
  actions: InvocationRuleAction[];
};

/**
 * An option in a field, operator, or action-target select list.
 *
 * @schemaObject
 */
export type InvocationRuleOption = {
  /** The value stored on the condition or action. */
  value: string;
  /** The human-readable label shown in the select. */
  label: string;
};

/**
 * Describes the change that caused an `onchange` call.
 * Consumers use the type to determine what to persist.
 */
export type InvocationRuleChange =
  | { type: 'add-rule'; ruleId: string }
  | { type: 'rename-rule'; ruleId: string }
  | { type: 'remove-rule'; ruleId: string }
  | { type: 'move-rule'; ruleId: string; fromIndex: number; toIndex: number }
  | { type: 'add-condition'; ruleId: string; conditionId: string }
  | { type: 'remove-condition'; ruleId: string; conditionId: string }
  | {
      type: 'update-condition';
      ruleId: string;
      conditionId: string;
      field: keyof InvocationRuleCondition;
    }
  | { type: 'add-action'; ruleId: string; actionId: string }
  | { type: 'remove-action'; ruleId: string; actionId: string }
  | { type: 'update-action'; ruleId: string; actionId: string };

/**
 * Props for the InvocationRuleBuilder component.
 *
 * Cinder owns no rule execution, persistence, or validation semantics.
 * All rule state is managed externally and passed in through the `rules`
 * prop. Every user action calls `onchange` with the next rule array and
 * a change descriptor; the consumer decides what to persist.
 */
export type InvocationRuleBuilderProps = Omit<
  HTMLAttributes<HTMLElement>,
  'class' | 'children' | 'onchange'
> & {
  /**
   * The current list of automation rules. Controlled — pass the updated
   * list returned from `onchange` back into this prop to commit a change.
   */
  rules: InvocationRule[];

  /**
   * Called whenever the user makes any edit. Receives the next rule
   * array (pure, not mutated) and a change descriptor. Consumer owns
   * persistence, validation, and execution.
   */
  onchange: (nextRules: InvocationRule[], change: InvocationRuleChange) => void;

  /**
   * Options for the condition field selector. Consumer-provided list of
   * fields that a condition can test, e.g. "path", "label", "author".
   */
  fieldOptions: InvocationRuleOption[];

  /**
   * Options for the condition operator selector. Consumer-provided list
   * of operators, e.g. "matches", "is", "is-not", "contains".
   */
  operatorOptions: InvocationRuleOption[];

  /**
   * Options for the action target selector. Consumer-provided list of
   * targets, e.g. review-agent slugs or step identifiers.
   */
  actionOptions: InvocationRuleOption[];

  /**
   * When true, renders a readonly summary of each rule instead of editable
   * controls. Default is false (editable mode).
   */
  readonly?: boolean;

  /**
   * Label for the "Add rule" button. Defaults to "Add rule".
   */
  addRuleLabel?: string;

  /**
   * Label for the "Add condition" button. Defaults to "Add condition".
   */
  addConditionLabel?: string;

  /**
   * Label for the "Add action" button. Defaults to "Add action".
   */
  addActionLabel?: string;

  /** Accessible label for the entire rule builder region. */
  label?: string;

  /** Additional CSS classes applied to the root element. */
  class?: string;
};

/**
 * Cinder-specific schema surface for InvocationRuleBuilder.
 *
 * The `onchange` callback is documented but marked unsupported because
 * functions cannot be represented as JSON Schema controls.
 */
export type InvocationRuleBuilderSchemaProps = {
  /**
   * The current list of automation rules. Controlled — pass the updated
   * list returned from `onchange` back into this prop to commit a change.
   */
  rules: InvocationRule[];

  /**
   * Options for the condition field selector. Consumer-provided list of
   * fields that a condition can test, e.g. "path", "label", "author".
   */
  fieldOptions: InvocationRuleOption[];

  /**
   * Options for the condition operator selector. Consumer-provided list
   * of operators, e.g. "matches", "is", "is-not", "contains".
   */
  operatorOptions: InvocationRuleOption[];

  /**
   * Options for the action target selector. Consumer-provided list of
   * targets, e.g. review-agent slugs or step identifiers.
   */
  actionOptions: InvocationRuleOption[];

  /**
   * When true, renders a readonly summary of each rule instead of editable
   * controls. Default is false (editable mode).
   */
  readonly?: boolean;

  /**
   * Label for the "Add rule" button. Defaults to "Add rule".
   */
  addRuleLabel?: string;

  /**
   * Label for the "Add condition" button. Defaults to "Add condition".
   */
  addConditionLabel?: string;

  /**
   * Label for the "Add action" button. Defaults to "Add action".
   */
  addActionLabel?: string;

  /** Accessible label for the entire rule builder region. */
  label?: string;

  /** Additional CSS classes applied to the root element. */
  class?: string;
};
