import type { HTMLAttributes } from 'svelte/elements';
import type { DataAttributes, WithoutDataAttributes } from '../../_internal/union-props.ts';

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
 * Describes the change that caused an `onValueChange` call.
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
// COR-239: keyof Props became too complex for TypeScript to represent (TS2590) once a consumer
// type-checked this published declaration under `skipLibCheck: false` — even a single, unvarying
// `HTMLAttributes<HTMLElement>`-derived base still carries the `data-*` index signature, and
// intersecting it with this file's mode/grouped-vs-flat/readonly-vs-editable union was enough to
// trigger it (no per-arm attribute-interface split was needed for the defect to appear here).
// Fix: strip `data-*` from the base (`WithoutDataAttributes` below) and restore it via a single
// non-distributed `DataAttributes` intersected once on `InvocationRuleBuilderProps`. See
// `src/_internal/union-props.ts` for the full mechanism. No prop was added, removed, widened, or
// narrowed — arbitrary `data-*` props are still accepted, exactly as before.
type InvocationRuleBuilderBaseProps = WithoutDataAttributes<
  Omit<HTMLAttributes<HTMLElement>, 'class' | 'children' | 'onchange'>
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

type InvocationRuleBuilderChangeHandler = (
  nextRules: InvocationRule[],
  change: InvocationRuleChange,
) => void;

type InvocationRuleBuilderConditionChangeHandler = (
  nextConditions: InvocationRuleCondition[],
  change: InvocationRuleConditionChange,
) => void;

// The mode/grouped-vs-flat/readonly-vs-editable discriminant below is intentionally written as
// one fully INLINE, fully-crossed six-arm union rather than through separately-named
// intermediate types (this file previously composed it from `InvocationRuleBuilderFullModeProps`,
// `InvocationRuleBuilderConditionsOnlyModeProps`, `InvocationRuleBuilderGroupedProps`,
// `InvocationRuleBuilderFlatConditionsProps`, and a generic `InvocationRuleBuilderReadonlyProps<
// ChangeHandler>` intersected together). That composed shape reintroduced TS2590 once the full
// fifteen-component baseline is checked together, even after `data-*` was stripped from
// `InvocationRuleBuilderBaseProps` above — named aliases to union members, used alongside a large
// attribute type, are themselves expensive here; the identical shapes fully crossed and written
// inline are not. See `src/_internal/union-props.ts` and card.types.ts for the general mechanism
// and a fuller writeup. Every one of the six arms below already carries the same nine keys
// (`rules`, `conditions`, `addRuleLabel`, `mode`, `operatorOptions`, `actionOptions`,
// `addActionLabel`, `onValueChange`, `readonly`), so no `PadUnion` is needed.
export type InvocationRuleBuilderProps = InvocationRuleBuilderBaseProps &
  DataAttributes &
  (
    | {
        rules: InvocationRule[];
        conditions?: never;
        addRuleLabel?: string;
        mode?: 'full';
        operatorOptions: InvocationRuleOption[];
        actionOptions: InvocationRuleOption[];
        addActionLabel?: string;
        /**
         * Called whenever the user makes any edit. Required for editable runtime
         * usage because editable controls must commit controlled state changes.
         * Receives the next controlled state (pure, not mutated) and a change descriptor.
         * Consumer owns persistence, validation, and execution.
         */
        onValueChange: InvocationRuleBuilderChangeHandler;
        /**
         * When false or omitted, renders editable controls. Editable mode requires
         * `onValueChange` so controls cannot become interactive-but-no-op.
         */
        readonly?: false;
      }
    | {
        rules: InvocationRule[];
        conditions?: never;
        addRuleLabel?: string;
        mode?: 'full';
        operatorOptions: InvocationRuleOption[];
        actionOptions: InvocationRuleOption[];
        addActionLabel?: string;
        /**
         * Optional in readonly usage because no edit controls are rendered.
         * Runtime consumers may still pass it when sharing props between modes.
         */
        onValueChange?: InvocationRuleBuilderChangeHandler;
        /**
         * When true, renders a readonly summary of each rule instead of editable
         * controls.
         */
        readonly: true;
      }
    | {
        rules: InvocationRule[];
        conditions?: never;
        addRuleLabel?: string;
        mode: 'conditions';
        operatorOptions?: never;
        actionOptions?: never;
        addActionLabel?: never;
        /**
         * Called whenever the user makes any edit. Required for editable runtime
         * usage because editable controls must commit controlled state changes.
         * Receives the next controlled state (pure, not mutated) and a change descriptor.
         * Consumer owns persistence, validation, and execution.
         */
        onValueChange: InvocationRuleBuilderChangeHandler;
        /**
         * When false or omitted, renders editable controls. Editable mode requires
         * `onValueChange` so controls cannot become interactive-but-no-op.
         */
        readonly?: false;
      }
    | {
        rules: InvocationRule[];
        conditions?: never;
        addRuleLabel?: string;
        mode: 'conditions';
        operatorOptions?: never;
        actionOptions?: never;
        addActionLabel?: never;
        /**
         * Optional in readonly usage because no edit controls are rendered.
         * Runtime consumers may still pass it when sharing props between modes.
         */
        onValueChange?: InvocationRuleBuilderChangeHandler;
        /**
         * When true, renders a readonly summary of each rule instead of editable
         * controls.
         */
        readonly: true;
      }
    | {
        mode: 'flat-conditions';
        conditions: InvocationRuleCondition[];
        rules?: never;
        addRuleLabel?: never;
        operatorOptions?: never;
        actionOptions?: never;
        addActionLabel?: never;
        /**
         * Called whenever the user makes any edit. Required for editable runtime
         * usage because editable controls must commit controlled state changes.
         * Receives the next controlled state (pure, not mutated) and a change descriptor.
         * Consumer owns persistence, validation, and execution.
         */
        onValueChange: InvocationRuleBuilderConditionChangeHandler;
        /**
         * When false or omitted, renders editable controls. Editable mode requires
         * `onValueChange` so controls cannot become interactive-but-no-op.
         */
        readonly?: false;
      }
    | {
        mode: 'flat-conditions';
        conditions: InvocationRuleCondition[];
        rules?: never;
        addRuleLabel?: never;
        operatorOptions?: never;
        actionOptions?: never;
        addActionLabel?: never;
        /**
         * Optional in readonly usage because no edit controls are rendered.
         * Runtime consumers may still pass it when sharing props between modes.
         */
        onValueChange?: InvocationRuleBuilderConditionChangeHandler;
        /**
         * When true, renders a readonly summary of each rule instead of editable
         * controls.
         */
        readonly: true;
      }
  );

/**
 * Cinder-specific schema surface for InvocationRuleBuilder.
 *
 * The `onValueChange` callback is documented but marked unsupported because
 * functions cannot be represented as JSON Schema controls.
 */
type InvocationRuleBuilderSchemaBaseProps = {
  /**
   * The current list of automation rules. Controlled — pass the updated
   * list returned from `onValueChange` back into this prop to commit a change.
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
   * `'flat-conditions'` for one direct conditions list. The schema requires
   * `conditions` only in flat mode and `rules` in both grouped modes; runtime
   * component types additionally reject mode-inapplicable option props.
   */
  mode?: InvocationRuleBuilderMode;

  /**
   * Options for the condition operator selector. Consumer-provided list
   * of operators, e.g. "matches", "is", "is-not", "contains". Required in
   * full mode; optional (and ignored) in both constrained conditions modes,
   * where cinder supplies a fixed operator set.
   */
  operatorOptions?: InvocationRuleOption[];

  /**
   * Options for the action target selector. Consumer-provided list of
   * targets, e.g. review-agent slugs or step identifiers. Required in full
   * mode; optional (and ignored) in both constrained conditions modes, where
   * actions are not rendered.
   */
  actionOptions?: InvocationRuleOption[];

  /**
   * Must be true for schema-driven usage because editable mode requires
   * the unsupported `onValueChange` callback. Runtime consumers may omit this
   * when passing `onValueChange` directly.
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

type InvocationRuleBuilderGroupedSchemaProps = {
  /**
   * The current list of automation rules. Controlled — pass the updated
   * list returned from `onValueChange` back into this prop to commit a change.
   */
  rules: InvocationRule[];

  /** Not accepted in grouped schema modes. */
  conditions?: never;

  /** Omit or pass `'full'` for conditions plus actions; pass `'conditions'` for conditions only. */
  mode?: 'full' | 'conditions';
};

type InvocationRuleBuilderFlatSchemaProps = {
  /** The direct controlled conditions list without rule-group metadata. */
  conditions: InvocationRuleCondition[];

  /** Not accepted in flat-conditions schema mode. */
  rules?: never;

  /** Render one direct implicit-AND conditions list. */
  mode: 'flat-conditions';
};

/**
 * Schema-driven props require the controlled state selected by `mode`, matching
 * the generated JSON Schema conditionals.
 */
export type InvocationRuleBuilderSchemaProps = InvocationRuleBuilderSchemaBaseProps &
  (InvocationRuleBuilderGroupedSchemaProps | InvocationRuleBuilderFlatSchemaProps);
