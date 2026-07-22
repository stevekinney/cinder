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
 * The value type a condition field represents. Determines which typed value
 * control renders for that field in conditions-only mode (`mode="conditions"`).
 * Ignored in full mode, where the condition value is always a free-text input.
 */
export type InvocationRuleFieldType = 'string' | 'number' | 'boolean' | 'enum';

/**
 * A single selectable choice for an `'enum'`-typed field's value, rendered as
 * a select in conditions-only mode. A flat value/label pair — enum choices do
 * not nest further.
 *
 * @schemaObject
 */
export type InvocationRuleValueChoice = {
  /** The value stored on the condition. */
  value: string;
  /** The human-readable label shown in the select. */
  label: string;
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
  /**
   * The value type this option represents when used as a field option in
   * conditions-only mode (`mode="conditions"`). Defaults to `'string'` when
   * omitted. Ignored for operator and action-target options, and ignored
   * entirely in full mode.
   */
  type?: InvocationRuleFieldType;
  /**
   * Enum choices for this field's value, rendered as a select in
   * conditions-only mode when `type` is `'enum'`. Provide these for an enum
   * field; if omitted or empty, the value select renders with no choices.
   * Ignored for non-enum field types.
   */
  options?: InvocationRuleValueChoice[];
};

/**
 * Rendering mode for InvocationRuleBuilder.
 *
 * - `'full'` (default) renders both conditions and actions, matching the
 *   component's original behavior exactly.
 * - `'conditions'` renders conditions only: action controls are hidden
 *   entirely, rules never emit action descriptors, the operator set is
 *   fixed to {@link InvocationRuleConditionsOnlyOperator}, and condition
 *   value controls are inferred from each field option's `type`.
 * - `'flat-conditions'` uses those same condition controls for one direct
 *   implicit-AND list, without rule-group metadata or controls.
 */
export type InvocationRuleBuilderMode = 'full' | 'conditions' | 'flat-conditions';

/**
 * The fixed operator vocabulary used in conditions-only mode
 * (`mode="conditions"`). Cinder supplies these five operators with default
 * labels; the `operatorOptions` prop is not accepted in this mode.
 */
export type InvocationRuleConditionsOnlyOperator = 'eq' | 'gt' | 'lt' | 'gte' | 'lte';

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
 * Describes a change to the direct conditions array used by
 * `mode="flat-conditions"`. Rule identifiers are intentionally absent because
 * the flat contract cannot represent rule groups.
 */
export type InvocationRuleConditionChange =
  | { type: 'add-condition'; conditionId: string }
  | { type: 'remove-condition'; conditionId: string }
  | {
      type: 'update-condition';
      conditionId: string;
      field: keyof InvocationRuleCondition;
    };

/**
 * Props for the InvocationRuleBuilder component.
 *
 * Cinder owns no rule execution, persistence, or validation semantics.
 * All state is managed externally. Grouped modes use `rules`, while
 * `mode="flat-conditions"` uses a direct `conditions` array so consumers do
 * not need to invent rule-group metadata.
 */
type InvocationRuleBuilderBaseProps = Omit<
  HTMLAttributes<HTMLElement>,
  'class' | 'children' | 'onchange'
> & {
  /**
   * Options for the condition field selector. Consumer-provided list of
   * fields that a condition can test, e.g. "path", "label", "author".
   */
  fieldOptions: InvocationRuleOption[];

  /**
   * Label for the "Add condition" button. Defaults to "Add condition".
   */
  addConditionLabel?: string;

  /** Accessible label for the entire rule builder region. */
  label?: string;

  /** Additional CSS classes applied to the root element. */
  class?: string;
};

/**
 * Mode-specific props for `mode="full"` (the default). Behavior and prop
 * shape are unchanged from before conditions-only mode existed.
 */
type InvocationRuleBuilderFullModeProps = {
  /**
   * Rendering mode. Omit or pass `'full'` to render both conditions and
   * actions — the component's original, unchanged behavior.
   */
  mode?: 'full';

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
   * Label for the "Add action" button. Defaults to "Add action".
   */
  addActionLabel?: string;
};

/**
 * Mode-specific props for `mode="conditions"`. Actions are not rendered, so
 * action-related props are not accepted — cinder owns the operator
 * vocabulary and there is nothing to configure for actions.
 */
type InvocationRuleBuilderConditionsOnlyModeProps = {
  /**
   * Renders conditions only: action controls are hidden entirely and rules
   * never emit action descriptors.
   */
  mode: 'conditions';

  /**
   * Not accepted in conditions-only mode. Cinder supplies the fixed
   * eq/gt/lt/gte/lte operator set internally; see
   * {@link InvocationRuleConditionsOnlyOperator}.
   */
  operatorOptions?: never;

  /** Not accepted in conditions-only mode — action controls are not rendered. */
  actionOptions?: never;

  /** Not accepted in conditions-only mode — action controls are not rendered. */
  addActionLabel?: never;
};

type InvocationRuleBuilderChangeHandler = (
  nextRules: InvocationRule[],
  change: InvocationRuleChange,
) => void;

type InvocationRuleBuilderConditionChangeHandler = (
  nextConditions: InvocationRuleCondition[],
  change: InvocationRuleConditionChange,
) => void;

type InvocationRuleBuilderReadonlyProps<ChangeHandler> =
  | {
      /**
       * Called whenever the user makes any edit. Required for editable runtime
       * usage because editable controls must commit controlled state changes.
       * Receives the next controlled state (pure, not mutated) and a change descriptor.
       * Consumer owns persistence, validation, and execution.
       */
      onchange: ChangeHandler;

      /**
       * When false or omitted, renders editable controls. Editable mode requires
       * `onchange` so controls cannot become interactive-but-no-op.
       */
      readonly?: false;
    }
  | {
      /**
       * Optional in readonly usage because no edit controls are rendered.
       * Runtime consumers may still pass it when sharing props between modes.
       */
      onchange?: ChangeHandler;

      /**
       * When true, renders a readonly summary of each rule instead of editable
       * controls.
       */
      readonly: true;
    };

type InvocationRuleBuilderGroupedProps = {
  /**
   * The current list of automation rules. Controlled — pass the updated
   * list returned from `onchange` back into this prop to commit a change.
   */
  rules: InvocationRule[];

  /** Not accepted in grouped modes. */
  conditions?: never;

  /** Label for the "Add rule" button. Defaults to "Add rule". */
  addRuleLabel?: string;
} & (InvocationRuleBuilderFullModeProps | InvocationRuleBuilderConditionsOnlyModeProps) &
  InvocationRuleBuilderReadonlyProps<InvocationRuleBuilderChangeHandler>;

type InvocationRuleBuilderFlatConditionsProps = {
  /**
   * Renders one direct, implicit-AND conditions list without rule headers or
   * rule-level controls.
   */
  mode: 'flat-conditions';

  /** The controlled flat conditions list. */
  conditions: InvocationRuleCondition[];

  /** Not accepted in flat-conditions mode. */
  rules?: never;

  /** Not accepted because flat-conditions mode has no rule controls. */
  addRuleLabel?: never;

  /** Cinder supplies the fixed eq/gt/lt/gte/lte operator set internally. */
  operatorOptions?: never;

  /** Not accepted because flat-conditions mode has no actions. */
  actionOptions?: never;

  /** Not accepted because flat-conditions mode has no actions. */
  addActionLabel?: never;
} & InvocationRuleBuilderReadonlyProps<InvocationRuleBuilderConditionChangeHandler>;

export type InvocationRuleBuilderProps = InvocationRuleBuilderBaseProps &
  (InvocationRuleBuilderGroupedProps | InvocationRuleBuilderFlatConditionsProps);

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
  rules?: InvocationRule[];

  /**
   * The direct controlled conditions list for `mode="flat-conditions"`.
   * This shape contains no rule-group metadata.
   */
  conditions?: InvocationRuleCondition[];

  /**
   * Options for the condition field selector. Consumer-provided list of
   * fields that a condition can test, e.g. "path", "label", "author".
   */
  fieldOptions: InvocationRuleOption[];

  /**
   * Rendering mode. Omit or pass `'full'` for the original conditions +
   * actions behavior; pass `'conditions'` for grouped conditions only, or
   * `'flat-conditions'` for one direct conditions list. Not
   * expressible as a schema-driven discriminant here because JSON Schema
   * validation of this component is documented, not enforced at runtime
   * against `operatorOptions`/`actionOptions` presence; see the component
   * types for the full mode-discriminated prop shape.
   */
  mode?: InvocationRuleBuilderMode;

  /**
   * Options for the condition operator selector. Consumer-provided list
   * of operators, e.g. "matches", "is", "is-not", "contains". Required in
   * full mode; optional (and ignored) when `mode` is `'conditions'`, since
   * cinder supplies a fixed operator set in that mode — so a conditions-only
   * configuration validates without it.
   */
  operatorOptions?: InvocationRuleOption[];

  /**
   * Options for the action target selector. Consumer-provided list of
   * targets, e.g. review-agent slugs or step identifiers. Required in full
   * mode; optional (and ignored) when `mode` is `'conditions'`, since actions
   * are not rendered — so a conditions-only configuration validates without it.
   */
  actionOptions?: InvocationRuleOption[];

  /**
   * Must be true for schema-driven usage because editable mode requires
   * the unsupported `onchange` callback. Runtime consumers may omit this
   * when passing `onchange` directly.
   */
  readonly: true;

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
