<script lang="ts" module>
  /**
   * @cinder
   * @category form
   * @status alpha
   * @purpose Render and edit conditional automation rules composed of conditions and actions.
   * @tag automation
   * @tag rules
   * @useWhen Building a UI for configuring which agents or services run based on event conditions.
   * @avoidWhen You need to execute, validate, or persist rules — cinder owns none of that logic.
   * @related capability-gate, steps, review-editor
   */
  export type {
    InvocationRule,
    InvocationRuleAction,
    InvocationRuleBuilderProps,
    InvocationRuleChange,
    InvocationRuleCondition,
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
  } from './invocation-rule-builder.types.ts';

  let {
    rules,
    onchange,
    fieldOptions,
    operatorOptions,
    actionOptions,
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

  /** Announcement text for the live region. */
  let announcement = $state('');
  let ruleLabelDrafts = $state<Record<string, string>>({});

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
    return rules.map((rule) => (rule.id === ruleId ? updater(rule) : rule));
  }

  // ---------------------------------------------------------------------------
  // Rule-level handlers
  // ---------------------------------------------------------------------------

  function handleAddRule(): void {
    const ruleId = generateId();
    const nextRules: InvocationRule[] = [
      ...rules,
      { id: ruleId, label: `Rule ${rules.length + 1}`, conditions: [], actions: [] },
    ];
    const change: InvocationRuleChange = { type: 'add-rule', ruleId };
    onchange(nextRules, change);
    announce('Rule added.');
  }

  function handleRemoveRule(ruleId: string, ruleLabel: string, ruleIndex: number): void {
    const nextRules = rules.filter((rule) => rule.id !== ruleId);
    const change: InvocationRuleChange = { type: 'remove-rule', ruleId };
    onchange(nextRules, change);
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
    if (toIndex < 0 || toIndex >= rules.length) return;
    const nextRules = [...rules];
    const [moved] = nextRules.splice(fromIndex, 1);
    nextRules.splice(toIndex, 0, moved!);
    const change: InvocationRuleChange = { type: 'move-rule', ruleId, fromIndex, toIndex };
    onchange(nextRules, change);
    announce(`${moved!.label} moved to position ${toIndex + 1} of ${nextRules.length}.`);
  }

  function handleRenameRule(ruleId: string, label: string): void {
    const nextLabel = label.trim() || 'Untitled rule';
    const { [ruleId]: _removedDraft, ...remainingDrafts } = ruleLabelDrafts;
    ruleLabelDrafts = remainingDrafts;
    const nextRules = updateRules(ruleId, (rule) => ({ ...rule, label: nextLabel }));
    const change: InvocationRuleChange = { type: 'rename-rule', ruleId };
    onchange(nextRules, change);
  }

  function ruleLabelDraft(rule: InvocationRule): string {
    return ruleLabelDrafts[rule.id] ?? rule.label;
  }

  // ---------------------------------------------------------------------------
  // Condition handlers
  // ---------------------------------------------------------------------------

  function handleAddCondition(ruleId: string): void {
    const conditionId = generateId();
    const firstField = fieldOptions[0]?.value ?? '';
    const firstOperator = operatorOptions[0]?.value ?? '';
    const nextRules = updateRules(ruleId, (rule) => ({
      ...rule,
      conditions: [
        ...rule.conditions,
        { id: conditionId, field: firstField, operator: firstOperator, value: '' },
      ],
    }));
    const change: InvocationRuleChange = { type: 'add-condition', ruleId, conditionId };
    onchange(nextRules, change);
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
    onchange(nextRules, change);
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
      conditions: rule.conditions.map((condition) =>
        condition.id === conditionId ? { ...condition, [field]: value } : condition,
      ),
    }));
    const change: InvocationRuleChange = {
      type: 'update-condition',
      ruleId,
      conditionId,
      field,
    };
    onchange(nextRules, change);
  }

  // ---------------------------------------------------------------------------
  // Action handlers
  // ---------------------------------------------------------------------------

  function handleAddAction(ruleId: string): void {
    const actionId = generateId();
    const firstTarget = actionOptions[0]?.value ?? '';
    const nextRules = updateRules(ruleId, (rule) => ({
      ...rule,
      actions: [...rule.actions, { id: actionId, target: firstTarget }],
    }));
    const change: InvocationRuleChange = { type: 'add-action', ruleId, actionId };
    onchange(nextRules, change);
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
    onchange(nextRules, change);
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
    onchange(nextRules, change);
  }

  // ---------------------------------------------------------------------------
  // Label helpers
  // ---------------------------------------------------------------------------

  function fieldLabel(value: string): string {
    return fieldOptions.find((option) => option.value === value)?.label ?? value;
  }

  function operatorLabel(value: string): string {
    return operatorOptions.find((option) => option.value === value)?.label ?? value;
  }

  function actionTargetLabel(value: string): string {
    return actionOptions.find((option) => option.value === value)?.label ?? value;
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
>
  {#each rules as rule, ruleIndex (rule.id)}
    <div class="cinder-invocation-rule-builder__rule" data-irb-rule={ruleIndex}>
      <div class="cinder-invocation-rule-builder__rule-header">
        {#if readonly}
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
                  [rule.id]: (event.target as HTMLInputElement).value,
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

        {#if !readonly}
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
              disabled={ruleIndex === rules.length - 1}
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

      <!-- Conditions section -->
      <div>
        <span
          id={`${baseId}-rule-${ruleIndex}-conditions-label`}
          class="cinder-invocation-rule-builder__section-heading"
        >
          Conditions
        </span>
        {#if !readonly && rule.conditions.length === 0}
          <p class="cinder-invocation-rule-builder__validation" role="status">
            Add at least one condition or this rule will always fire.
          </p>
        {/if}

        {#if readonly}
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
                  value={condition.operator}
                  onchange={(event) =>
                    handleUpdateCondition(
                      rule.id,
                      condition.id,
                      'operator',
                      (event.target as HTMLSelectElement).value,
                    )}
                >
                  {#each operatorOptions as option (option.value)}
                    <option value={option.value}>{option.label}</option>
                  {/each}
                </select>

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

      <!-- Actions section -->
      <div>
        <span
          id={`${baseId}-rule-${ruleIndex}-actions-label`}
          class="cinder-invocation-rule-builder__section-heading"
        >
          Actions
        </span>
        {#if !readonly && rule.actions.length === 0}
          <p class="cinder-invocation-rule-builder__validation" role="status">
            Add at least one action for this rule.
          </p>
        {/if}

        {#if readonly}
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
                  {#each actionOptions as option (option.value)}
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
    </div>
  {/each}

  {#if !readonly}
    <button
      type="button"
      class="cinder-invocation-rule-builder__add-btn cinder-invocation-rule-builder__add-rule-btn"
      data-irb-add-rule
      onclick={handleAddRule}
    >
      + {addRuleLabel}
    </button>
  {/if}

  {#if rules.length === 0 && readonly}
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
