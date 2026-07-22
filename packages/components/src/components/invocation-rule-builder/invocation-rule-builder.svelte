<script lang="ts" module>
  /**
   * @cinder
   * @category form
   * @status beta
   * @purpose Render and edit conditional automation rules composed of conditions and actions.
   * @tag automation
   * @tag rules
   * @useWhen Building a UI for configuring which agents or services run based on event conditions.
   * @useWhen You only need conditions (no actions) — pass mode="conditions" for a constrained operator set and typed value inputs.
   * @useWhen Your data is one flat implicit-AND conditions list — pass mode="flat-conditions" without rule-group metadata.
   * @avoidWhen You need to execute, validate, or persist rules — cinder owns none of that logic.
   * @related capability-gate, steps, review-editor
   */
  export type {
    InvocationRule,
    InvocationRuleAction,
    InvocationRuleBuilderMode,
    InvocationRuleBuilderProps,
    InvocationRuleBuilderSchemaProps,
    InvocationRuleChange,
    InvocationRuleCondition,
    InvocationRuleConditionChange,
    InvocationRuleConditionsOnlyOperator,
    InvocationRuleFieldType,
    InvocationRuleOption,
  } from './invocation-rule-builder.types.ts';
</script>

<script lang="ts">
  import { tick } from 'svelte';
  import { classNames } from '../../utilities/class-names.ts';
  import type {
    InvocationRule,
    InvocationRuleAction,
    InvocationRuleBuilderProps,
    InvocationRuleChange,
    InvocationRuleCondition,
    InvocationRuleConditionChange,
    InvocationRuleFieldType,
    InvocationRuleOption,
    InvocationRuleValueChoice,
  } from './invocation-rule-builder.types.ts';

  /**
   * Fixed operator vocabulary for conditions-only mode (`mode="conditions"`).
   * Cinder supplies these with default labels; the `operatorOptions` prop is
   * not accepted in this mode.
   */
  const CONDITIONS_ONLY_OPERATOR_OPTIONS: InvocationRuleOption[] = [
    { value: 'eq', label: 'equals' },
    { value: 'gt', label: 'greater than' },
    { value: 'lt', label: 'less than' },
    { value: 'gte', label: 'greater than or equal' },
    { value: 'lte', label: 'less than or equal' },
  ];

  let {
    rules = [],
    conditions = [],
    onchange,
    fieldOptions,
    operatorOptions,
    actionOptions,
    mode = 'full',
    readonly = false,
    addRuleLabel = 'Add rule',
    addConditionLabel = 'Add condition',
    addActionLabel = 'Add action',
    label,
    class: className,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledby,
    ...rest
  }: InvocationRuleBuilderProps = $props();

  const baseId = $props.id();
  const sectionAriaLabel = $derived(
    ariaLabelledby ? undefined : (ariaLabel ?? label ?? 'Invocation rules'),
  );
  const effectiveReadonly = $derived(readonly || onchange === undefined);
  const conditionsOnly = $derived(mode !== 'full');
  const flatConditions = $derived(mode === 'flat-conditions');
  const renderedRules = $derived(
    flatConditions
      ? [{ id: `${baseId}-flat`, label: 'Conditions', conditions, actions: [] }]
      : rules,
  );

  /**
   * The operator options actually rendered and used for new conditions.
   * Fixed in conditions-only mode; consumer-supplied in full mode.
   */
  const resolvedOperatorOptions = $derived(
    conditionsOnly ? CONDITIONS_ONLY_OPERATOR_OPTIONS : (operatorOptions ?? []),
  );
  const resolvedActionOptions = $derived(actionOptions ?? []);

  /** The declared value type for a field, defaulting to `'string'`. */
  function fieldValueType(fieldValue: string): InvocationRuleFieldType {
    return fieldOptions.find((option) => option.value === fieldValue)?.type ?? 'string';
  }

  /** Enum choices declared on a field option, or an empty list. */
  function fieldEnumOptions(fieldValue: string): InvocationRuleValueChoice[] {
    return fieldOptions.find((option) => option.value === fieldValue)?.options ?? [];
  }

  /**
   * The type-appropriate default `value` for a field in conditions-only mode —
   * used both when a condition is first added and when its `field` changes to
   * one of a different (or enum-incompatible) type, so the stored value always
   * matches what the typed control actually renders.
   */
  function defaultConditionValue(fieldValue: string): string {
    const type = fieldValueType(fieldValue);
    switch (type) {
      case 'boolean':
        // Matches the checkbox's own read: `checked={condition.value === 'true'}`.
        return 'false';
      case 'enum':
        return fieldEnumOptions(fieldValue)[0]?.value ?? '';
      case 'number':
      case 'string':
        return '';
    }
  }

  /**
   * A number-LIKE string — permissive enough to accept every intermediate
   * state a user legitimately passes through while typing into a native
   * `<input type="number">` (a lone `-`, a trailing `.` as in `'1.'`, a
   * partial exponent like `'1e'` or `'1e5'`, `'-2.5'`, and so on), so
   * `emitChange` — which runs on every value edit, not just field changes —
   * never fights live typing by blanking a value mid-keystroke.
   *
   * It still rejects strings a number input would never produce and that
   * only arrive as stale prop data: hex (`'0x10'`), units (`'5px'`), plain
   * words (`'foo'`), exponent-only fragments with no mantissa (`'e'`, `'+e'`,
   * `'e+'`), or whitespace mixed with letters. The first alternative covers a
   * digit-bearing number with an optional exponent; the second covers the bare
   * sign/decimal intermediates (`''`, `'-'`, `'+'`, `'.'`, `'-.'`) that a number
   * input surfaces mid-typing — an exponent is only ever valid glued to a
   * mantissa, never on its own.
   */
  const NUMBER_LIKE_VALUE_PATTERN = /^([+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d*)?|[+-]?\.?)$/i;

  /**
   * Whether a stored condition value is still a faithful representation of
   * what the typed control for `type` would render — i.e. whether it's safe
   * to keep across a field change instead of resetting to the type's default.
   */
  function isValueValidForFieldType(
    value: string,
    type: InvocationRuleFieldType,
    fieldValue: string,
  ): boolean {
    switch (type) {
      case 'boolean':
        return value === 'true' || value === 'false';
      case 'enum':
        return fieldEnumOptions(fieldValue).some((option) => option.value === value);
      case 'number':
        // Blank is allowed; otherwise a number-like string is valid — lenient
        // enough to not fight live typing, strict enough to still reject stale
        // non-numeric data like hex or unit-suffixed strings. A whitespace-only
        // value renders blank in the number input, so it is treated as invalid
        // (normalized to '') rather than persisting the hidden spaces.
        return (
          value === '' || (value.trim() !== '' && NUMBER_LIKE_VALUE_PATTERN.test(value.trim()))
        );
      case 'string':
        return true;
    }
  }

  /** Whether `operator` is one of the fixed conditions-only mode operators. */
  function isConditionsOnlyOperator(operator: string): boolean {
    return CONDITIONS_ONLY_OPERATOR_OPTIONS.some((option) => option.value === operator);
  }

  /**
   * The operator to display for a condition — in the readonly summary label
   * and as the selected value of the editable operator `<select>`. In full
   * mode this is always the raw stored operator. In conditions-only mode, a
   * rule can arrive carrying a legacy operator outside the fixed
   * eq/gt/lt/gte/lte set (e.g. a leftover `'matches'` from full mode); this
   * displays `'eq'` in that case instead of an operator the mode forbids —
   * matching what `emitChange` would coerce it to on the next edit, and
   * keeping the operator `<select>` always showing a valid selected option.
   */
  function displayOperator(operator: string): string {
    return conditionsOnly && !isConditionsOnlyOperator(operator) ? 'eq' : operator;
  }

  /**
   * Emits `onchange`. In conditions-only mode, normalizes every emitted rule
   * first so it's internally consistent regardless of what the incoming
   * `rules` prop originally carried (e.g. a consumer switching existing
   * full-mode rules into conditions-only mode):
   *
   * - Strips `actions` — conditions-only rules never carry an action target.
   * - Coerces any condition `operator` outside the fixed eq/gt/lt/gte/lte set
   *   to `'eq'` (e.g. a leftover full-mode operator like `'matches'`).
   * - Coerces any condition `value` that isn't valid for its field's
   *   inferred type to that type's default (e.g. a boolean field whose value
   *   is an arbitrary string, or an enum field whose value isn't one of its
   *   choices) — the same check and defaults used for field-type changes.
   *
   * Full mode passes rules through unchanged.
   */
  function emitChange(nextRules: InvocationRule[], change: InvocationRuleChange): void {
    const rulesToEmit = conditionsOnly
      ? nextRules.map((rule) => ({
          ...rule,
          actions: [],
          conditions: rule.conditions.map((condition) => {
            const operator = isConditionsOnlyOperator(condition.operator)
              ? condition.operator
              : 'eq';
            const type = fieldValueType(condition.field);
            const value = isValueValidForFieldType(condition.value, type, condition.field)
              ? condition.value
              : defaultConditionValue(condition.field);
            return operator === condition.operator && value === condition.value
              ? condition
              : { ...condition, operator, value };
          }),
        }))
      : nextRules;
    if (flatConditions) {
      if (
        change.type !== 'add-condition' &&
        change.type !== 'remove-condition' &&
        change.type !== 'update-condition'
      ) {
        return;
      }
      const { ruleId: _ruleId, ...conditionChange } = change;
      const conditionChangeHandler = onchange as
        | ((
            nextConditions: InvocationRuleCondition[],
            conditionChange: InvocationRuleConditionChange,
          ) => void)
        | undefined;
      conditionChangeHandler?.(rulesToEmit[0]?.conditions ?? [], conditionChange);
      return;
    }
    const ruleChangeHandler = onchange as
      | ((nextRules: InvocationRule[], ruleChange: InvocationRuleChange) => void)
      | undefined;
    ruleChangeHandler?.(rulesToEmit, change);
  }

  /** Announcement text for the live region. */
  let announcement = $state('');
  let ruleLabelDrafts = $state<Record<string, { baseLabel: string; value: string }>>({});

  function announce(message: string): void {
    announcement = '';
    // Reset then set on the next tick so repeated identical messages re-trigger
    // the live region update.
    tick().then(() => {
      announcement = message;
    });
  }

  // ---------------------------------------------------------------------------
  // Pure rule-mutation helpers (never mutate input; always return new arrays)
  // ---------------------------------------------------------------------------

  function generateId(): string {
    return `${Math.random().toString(36).slice(2)}-${Date.now()}`;
  }

  function updateRules(
    ruleId: string,
    updater: (rule: InvocationRule) => InvocationRule,
  ): InvocationRule[] {
    return renderedRules.map((rule) => (rule.id === ruleId ? updater(rule) : rule));
  }

  // ---------------------------------------------------------------------------
  // Rule-level handlers
  // ---------------------------------------------------------------------------

  function handleAddRule(): void {
    const ruleId = generateId();
    const nextRules: InvocationRule[] = [
      ...renderedRules,
      { id: ruleId, label: `Rule ${renderedRules.length + 1}`, conditions: [], actions: [] },
    ];
    const change: InvocationRuleChange = { type: 'add-rule', ruleId };
    emitChange(nextRules, change);
    announce('Rule added.');
  }

  function handleRemoveRule(ruleId: string, ruleLabel: string, ruleIndex: number): void {
    const nextRules = renderedRules.filter((rule) => rule.id !== ruleId);
    const change: InvocationRuleChange = { type: 'remove-rule', ruleId };
    emitChange(nextRules, change);
    announce(`${ruleLabel} removed.`);

    // Move focus to the previous rule's remove button, or the add-rule button.
    tick().then(() => {
      const targetIndex = ruleIndex > 0 ? ruleIndex - 1 : 0;
      const ruleElements = document.querySelectorAll<HTMLElement>(
        `[data-irb-region="${baseId}"] [data-irb-rule-remove]`,
      );
      const targetButton =
        ruleElements[targetIndex] ??
        document.querySelector<HTMLElement>(`[data-irb-region="${baseId}"] [data-irb-add-rule]`);
      targetButton?.focus();
    });
  }

  function handleMoveRule(ruleId: string, fromIndex: number, direction: -1 | 1): void {
    const toIndex = fromIndex + direction;
    if (toIndex < 0 || toIndex >= renderedRules.length) return;
    const nextRules = [...renderedRules];
    const [moved] = nextRules.splice(fromIndex, 1);
    nextRules.splice(toIndex, 0, moved!);
    const change: InvocationRuleChange = { type: 'move-rule', ruleId, fromIndex, toIndex };
    emitChange(nextRules, change);
    announce(`${moved!.label} moved to position ${toIndex + 1} of ${nextRules.length}.`);
  }

  function handleRenameRule(ruleId: string, label: string): void {
    const nextLabel = label.trim() || 'Untitled rule';
    const { [ruleId]: _removedDraft, ...remainingDrafts } = ruleLabelDrafts;
    ruleLabelDrafts = remainingDrafts;
    const currentLabel = renderedRules.find((rule) => rule.id === ruleId)?.label;
    if (currentLabel === nextLabel) return;
    const nextRules = updateRules(ruleId, (rule) => ({ ...rule, label: nextLabel }));
    const change: InvocationRuleChange = { type: 'rename-rule', ruleId };
    emitChange(nextRules, change);
  }

  function ruleLabelDraft(rule: InvocationRule): string {
    const draft = ruleLabelDrafts[rule.id];
    return draft?.baseLabel === rule.label ? draft.value : rule.label;
  }

  // ---------------------------------------------------------------------------
  // Condition handlers
  // ---------------------------------------------------------------------------

  function handleAddCondition(ruleId: string): void {
    const conditionId = generateId();
    const firstField = fieldOptions[0]?.value ?? '';
    const firstOperator = resolvedOperatorOptions[0]?.value ?? '';
    // In conditions-only mode, seed a type-appropriate default (e.g. 'false'
    // for a boolean field, the first choice for an enum field) so the stored
    // value matches what the typed control renders immediately on add.
    const initialValue = conditionsOnly ? defaultConditionValue(firstField) : '';
    const nextRules = updateRules(ruleId, (rule) => ({
      ...rule,
      conditions: [
        ...rule.conditions,
        { id: conditionId, field: firstField, operator: firstOperator, value: initialValue },
      ],
    }));
    const change: InvocationRuleChange = { type: 'add-condition', ruleId, conditionId };
    emitChange(nextRules, change);
    announce('Condition added.');
  }

  function handleRemoveCondition(
    ruleId: string,
    conditionId: string,
    conditionIndex: number,
    ruleIndex: number,
  ): void {
    const nextRules = updateRules(ruleId, (rule) => ({
      ...rule,
      conditions: rule.conditions.filter((condition) => condition.id !== conditionId),
    }));
    const change: InvocationRuleChange = { type: 'remove-condition', ruleId, conditionId };
    emitChange(nextRules, change);
    announce('Condition removed.');

    tick().then(() => {
      const ruleEl = document.querySelector<HTMLElement>(
        `[data-irb-region="${baseId}"] [data-irb-rule="${ruleIndex}"]`,
      );
      const removeButtons = ruleEl?.querySelectorAll<HTMLElement>('[data-irb-condition-remove]');
      const addBtn = ruleEl?.querySelector<HTMLElement>('[data-irb-add-condition]');
      const targetButton =
        (removeButtons && removeButtons[conditionIndex > 0 ? conditionIndex - 1 : 0]) ?? addBtn;
      targetButton?.focus();
    });
  }

  function handleUpdateCondition(
    ruleId: string,
    conditionId: string,
    field: keyof InvocationRuleCondition,
    value: string,
  ): void {
    const nextRules = updateRules(ruleId, (rule) => ({
      ...rule,
      conditions: rule.conditions.map((condition) => {
        if (condition.id !== conditionId) return condition;
        // Changing which field a condition tests, in conditions-only mode: if
        // the current value is no longer a faithful representation of the new
        // field's type (e.g. an arbitrary string against a field that's now
        // boolean, or a value outside a new enum field's choices), reset it to
        // that type's default so the stored value matches the typed control
        // that's about to render. Same-type (and enum-with-matching-value)
        // field changes keep the value the user already entered.
        if (field === 'field' && conditionsOnly) {
          const nextType = fieldValueType(value);
          const nextValue = isValueValidForFieldType(condition.value, nextType, value)
            ? condition.value
            : defaultConditionValue(value);
          return { ...condition, field: value, value: nextValue };
        }
        return { ...condition, [field]: value };
      }),
    }));
    const change: InvocationRuleChange = {
      type: 'update-condition',
      ruleId,
      conditionId,
      field,
    };
    emitChange(nextRules, change);
  }

  // ---------------------------------------------------------------------------
  // Action handlers
  // ---------------------------------------------------------------------------

  function handleAddAction(ruleId: string): void {
    const actionId = generateId();
    const firstTarget = resolvedActionOptions[0]?.value ?? '';
    const nextRules = updateRules(ruleId, (rule) => ({
      ...rule,
      actions: [...rule.actions, { id: actionId, target: firstTarget }],
    }));
    const change: InvocationRuleChange = { type: 'add-action', ruleId, actionId };
    emitChange(nextRules, change);
    announce('Action added.');
  }

  function handleRemoveAction(
    ruleId: string,
    actionId: string,
    actionIndex: number,
    ruleIndex: number,
  ): void {
    const nextRules = updateRules(ruleId, (rule) => ({
      ...rule,
      actions: rule.actions.filter((action) => action.id !== actionId),
    }));
    const change: InvocationRuleChange = { type: 'remove-action', ruleId, actionId };
    emitChange(nextRules, change);
    announce('Action removed.');

    tick().then(() => {
      const ruleEl = document.querySelector<HTMLElement>(
        `[data-irb-region="${baseId}"] [data-irb-rule="${ruleIndex}"]`,
      );
      const removeButtons = ruleEl?.querySelectorAll<HTMLElement>('[data-irb-action-remove]');
      const addBtn = ruleEl?.querySelector<HTMLElement>('[data-irb-add-action]');
      const targetButton =
        (removeButtons && removeButtons[actionIndex > 0 ? actionIndex - 1 : 0]) ?? addBtn;
      targetButton?.focus();
    });
  }

  function handleUpdateAction(ruleId: string, actionId: string, target: string): void {
    const nextRules = updateRules(ruleId, (rule) => ({
      ...rule,
      actions: rule.actions.map((action) =>
        action.id === actionId ? { ...action, target } : action,
      ),
    }));
    const change: InvocationRuleChange = { type: 'update-action', ruleId, actionId };
    emitChange(nextRules, change);
  }

  // ---------------------------------------------------------------------------
  // Label helpers
  // ---------------------------------------------------------------------------

  function fieldLabel(value: string): string {
    return fieldOptions.find((option) => option.value === value)?.label ?? value;
  }

  function operatorLabel(value: string): string {
    const displayValue = displayOperator(value);
    return (
      resolvedOperatorOptions.find((option) => option.value === displayValue)?.label ?? displayValue
    );
  }

  function actionTargetLabel(value: string): string {
    return resolvedActionOptions.find((option) => option.value === value)?.label ?? value;
  }

  function conditionSummary(condition: InvocationRuleCondition): string {
    return `${fieldLabel(condition.field)} ${operatorLabel(condition.operator)} "${condition.value}"`;
  }

  function actionSummary(action: InvocationRuleAction): string {
    return `Invoke ${actionTargetLabel(action.target)}`;
  }
</script>

<section
  {...rest}
  class={classNames('cinder-invocation-rule-builder', className)}
  aria-label={sectionAriaLabel}
  aria-labelledby={ariaLabelledby}
  data-irb-region={baseId}
  data-irb-flat={flatConditions || undefined}
>
  {#each renderedRules as rule, ruleIndex (rule.id)}
    <div class="cinder-invocation-rule-builder__rule" data-irb-rule={ruleIndex}>
      {#if !flatConditions}
        <div class="cinder-invocation-rule-builder__rule-header">
          {#if effectiveReadonly}
            <h3 class="cinder-invocation-rule-builder__rule-label">{rule.label}</h3>
          {:else}
            <label class="cinder-invocation-rule-builder__rule-label-field">
              <span class="cinder-sr-only">Rule name</span>
              <input
                class="cinder-invocation-rule-builder__rule-label-input"
                value={ruleLabelDraft(rule)}
                aria-label={`Rule name for ${rule.label}`}
                oninput={(event) =>
                  (ruleLabelDrafts = {
                    ...ruleLabelDrafts,
                    [rule.id]: {
                      baseLabel: rule.label,
                      value: (event.target as HTMLInputElement).value,
                    },
                  })}
                onblur={(event) =>
                  handleRenameRule(rule.id, (event.target as HTMLInputElement).value)}
                onkeydown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    (event.currentTarget as HTMLInputElement).blur();
                  }
                }}
              />
            </label>
          {/if}

          {#if !effectiveReadonly}
            <div class="cinder-invocation-rule-builder__rule-controls">
              <button
                type="button"
                class="cinder-invocation-rule-builder__icon-btn"
                aria-label={`Move ${rule.label} up`}
                disabled={ruleIndex === 0}
                onclick={() => handleMoveRule(rule.id, ruleIndex, -1)}
              >
                <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                  <path d="M8 3l5 6H3z" />
                </svg>
              </button>
              <button
                type="button"
                class="cinder-invocation-rule-builder__icon-btn"
                aria-label={`Move ${rule.label} down`}
                disabled={ruleIndex === renderedRules.length - 1}
                onclick={() => handleMoveRule(rule.id, ruleIndex, 1)}
              >
                <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                  <path d="M8 13l-5-6h10z" />
                </svg>
              </button>
              <button
                type="button"
                class="cinder-invocation-rule-builder__icon-btn"
                aria-label={`Remove ${rule.label}`}
                data-irb-rule-remove
                onclick={() => handleRemoveRule(rule.id, rule.label, ruleIndex)}
              >
                <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                  <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="2" fill="none" />
                </svg>
              </button>
            </div>
          {/if}
        </div>
      {/if}

      <!-- Conditions section -->
      <div>
        <span
          id={`${baseId}-rule-${ruleIndex}-conditions-label`}
          class="cinder-invocation-rule-builder__section-heading"
        >
          Conditions
        </span>
        {#if !effectiveReadonly && rule.conditions.length === 0}
          <p class="cinder-invocation-rule-builder__validation" role="status">
            Add at least one condition or this rule will always fire.
          </p>
        {/if}

        {#if effectiveReadonly}
          <div
            class="cinder-invocation-rule-builder__summary"
            aria-label={`Conditions for ${rule.label}`}
          >
            {#if rule.conditions.length === 0}
              <p class="cinder-invocation-rule-builder__empty">
                No conditions — rule always fires.
              </p>
            {:else}
              {#each rule.conditions as condition (condition.id)}
                <div class="cinder-invocation-rule-builder__summary-row">
                  {conditionSummary(condition)}
                </div>
              {/each}
            {/if}
          </div>
        {:else}
          <div
            class="cinder-invocation-rule-builder__conditions"
            role="list"
            aria-labelledby={`${baseId}-rule-${ruleIndex}-conditions-label`}
          >
            {#each rule.conditions as condition, conditionIndex (condition.id)}
              <div class="cinder-invocation-rule-builder__condition" role="listitem">
                <select
                  class="cinder-invocation-rule-builder__condition-select"
                  aria-label={`Field for condition ${conditionIndex + 1} of ${rule.label}`}
                  value={condition.field}
                  onchange={(event) =>
                    handleUpdateCondition(
                      rule.id,
                      condition.id,
                      'field',
                      (event.target as HTMLSelectElement).value,
                    )}
                >
                  {#each fieldOptions as option (option.value)}
                    <option value={option.value}>{option.label}</option>
                  {/each}
                </select>

                <select
                  class="cinder-invocation-rule-builder__condition-select"
                  aria-label={`Operator for condition ${conditionIndex + 1} of ${rule.label}`}
                  value={displayOperator(condition.operator)}
                  onchange={(event) =>
                    handleUpdateCondition(
                      rule.id,
                      condition.id,
                      'operator',
                      (event.target as HTMLSelectElement).value,
                    )}
                >
                  {#each resolvedOperatorOptions as option (option.value)}
                    <option value={option.value}>{option.label}</option>
                  {/each}
                </select>

                {#if conditionsOnly && fieldValueType(condition.field) === 'number'}
                  <input
                    type="number"
                    class="cinder-invocation-rule-builder__condition-value"
                    aria-label={`Value for condition ${conditionIndex + 1} of ${rule.label}`}
                    placeholder="Value to compare"
                    value={condition.value}
                    oninput={(event) =>
                      handleUpdateCondition(
                        rule.id,
                        condition.id,
                        'value',
                        (event.target as HTMLInputElement).value,
                      )}
                  />
                {:else if conditionsOnly && fieldValueType(condition.field) === 'boolean'}
                  <input
                    type="checkbox"
                    class="cinder-invocation-rule-builder__condition-value-checkbox"
                    aria-label={`Value for condition ${conditionIndex + 1} of ${rule.label}`}
                    checked={condition.value === 'true'}
                    onchange={(event) =>
                      handleUpdateCondition(
                        rule.id,
                        condition.id,
                        'value',
                        String((event.target as HTMLInputElement).checked),
                      )}
                  />
                {:else if conditionsOnly && fieldValueType(condition.field) === 'enum'}
                  <select
                    class="cinder-invocation-rule-builder__condition-select cinder-invocation-rule-builder__condition-value-select"
                    aria-label={`Value for condition ${conditionIndex + 1} of ${rule.label}`}
                    value={condition.value}
                    onchange={(event) =>
                      handleUpdateCondition(
                        rule.id,
                        condition.id,
                        'value',
                        (event.target as HTMLSelectElement).value,
                      )}
                  >
                    {#each fieldEnumOptions(condition.field) as option (option.value)}
                      <option value={option.value}>{option.label}</option>
                    {/each}
                  </select>
                {:else}
                  <input
                    type="text"
                    class="cinder-invocation-rule-builder__condition-value"
                    aria-label={`Value for condition ${conditionIndex + 1} of ${rule.label}`}
                    placeholder="Value to compare"
                    value={condition.value}
                    oninput={(event) =>
                      handleUpdateCondition(
                        rule.id,
                        condition.id,
                        'value',
                        (event.target as HTMLInputElement).value,
                      )}
                  />
                {/if}

                <button
                  type="button"
                  class="cinder-invocation-rule-builder__icon-btn"
                  aria-label={`Remove condition ${conditionIndex + 1} of ${rule.label}`}
                  data-irb-condition-remove
                  onclick={() =>
                    handleRemoveCondition(rule.id, condition.id, conditionIndex, ruleIndex)}
                >
                  <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                    <path
                      d="M4 4l8 8M12 4l-8 8"
                      stroke="currentColor"
                      stroke-width="2"
                      fill="none"
                    />
                  </svg>
                </button>
              </div>
            {/each}
          </div>

          <button
            type="button"
            class="cinder-invocation-rule-builder__add-btn"
            aria-label={`${addConditionLabel} to ${rule.label}`}
            data-irb-add-condition
            onclick={() => handleAddCondition(rule.id)}
          >
            + {addConditionLabel}
          </button>
        {/if}
      </div>

      <!-- Actions section — hidden entirely in conditions-only mode. -->
      {#if mode === 'full'}
        <div>
          <span
            id={`${baseId}-rule-${ruleIndex}-actions-label`}
            class="cinder-invocation-rule-builder__section-heading"
          >
            Actions
          </span>
          {#if !effectiveReadonly && rule.actions.length === 0}
            <p class="cinder-invocation-rule-builder__validation" role="status">
              Add at least one action for this rule.
            </p>
          {/if}

          {#if effectiveReadonly}
            <div
              class="cinder-invocation-rule-builder__summary"
              aria-label={`Actions for ${rule.label}`}
            >
              {#if rule.actions.length === 0}
                <p class="cinder-invocation-rule-builder__empty">No actions configured.</p>
              {:else}
                {#each rule.actions as action (action.id)}
                  <div class="cinder-invocation-rule-builder__summary-row">
                    {actionSummary(action)}
                  </div>
                {/each}
              {/if}
            </div>
          {:else}
            <div
              class="cinder-invocation-rule-builder__actions"
              role="list"
              aria-labelledby={`${baseId}-rule-${ruleIndex}-actions-label`}
            >
              {#each rule.actions as action, actionIndex (action.id)}
                <div class="cinder-invocation-rule-builder__action" role="listitem">
                  <select
                    class="cinder-invocation-rule-builder__action-select"
                    aria-label={`Action ${actionIndex + 1} target for ${rule.label}`}
                    value={action.target}
                    onchange={(event) =>
                      handleUpdateAction(
                        rule.id,
                        action.id,
                        (event.target as HTMLSelectElement).value,
                      )}
                  >
                    {#each resolvedActionOptions as option (option.value)}
                      <option value={option.value}>{option.label}</option>
                    {/each}
                  </select>

                  <button
                    type="button"
                    class="cinder-invocation-rule-builder__icon-btn"
                    aria-label={`Remove action ${actionIndex + 1} of ${rule.label}`}
                    data-irb-action-remove
                    onclick={() => handleRemoveAction(rule.id, action.id, actionIndex, ruleIndex)}
                  >
                    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                      <path
                        d="M4 4l8 8M12 4l-8 8"
                        stroke="currentColor"
                        stroke-width="2"
                        fill="none"
                      />
                    </svg>
                  </button>
                </div>
              {/each}
            </div>

            <button
              type="button"
              class="cinder-invocation-rule-builder__add-btn"
              aria-label={`${addActionLabel} to ${rule.label}`}
              data-irb-add-action
              onclick={() => handleAddAction(rule.id)}
            >
              + {addActionLabel}
            </button>
          {/if}
        </div>
      {/if}
    </div>
  {/each}

  {#if !effectiveReadonly && !flatConditions}
    <button
      type="button"
      class="cinder-invocation-rule-builder__add-btn cinder-invocation-rule-builder__add-rule-btn"
      data-irb-add-rule
      onclick={handleAddRule}
    >
      + {addRuleLabel}
    </button>
  {/if}

  {#if renderedRules.length === 0 && effectiveReadonly}
    <p class="cinder-invocation-rule-builder__empty">No rules configured.</p>
  {/if}
</section>

<!-- Live region stays in DOM always; content toggled so screen readers re-announce. -->
<div
  role="status"
  aria-live="polite"
  aria-atomic="true"
  class="cinder-invocation-rule-builder__announcer"
>
  {announcement}
</div>
