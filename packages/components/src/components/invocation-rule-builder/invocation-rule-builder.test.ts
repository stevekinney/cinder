/// <reference lib="dom" />
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';

import Ajv2020 from 'ajv/dist/2020';
import { setupHappyDom } from '../../test/happy-dom.ts';
import type {
  InvocationRule,
  InvocationRuleAction,
  InvocationRuleBuilderProps,
  InvocationRuleCondition,
  InvocationRuleOption,
} from './invocation-rule-builder.types.ts';

setupHappyDom();

const { cleanup, fireEvent, render } = await import('@testing-library/svelte');
const { default: InvocationRuleBuilder } = await import('./invocation-rule-builder.svelte');
const { default: invocationRuleBuilderSchema } =
  await import('./invocation-rule-builder.schema.ts');

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
  { value: 'security-review', label: 'Security Review' },
  { value: 'code-review', label: 'Code Review' },
];

function makeCondition(overrides?: Partial<InvocationRuleCondition>): InvocationRuleCondition {
  return {
    id: 'c1',
    field: 'path',
    operator: 'matches',
    value: 'src/**',
    ...overrides,
  };
}

function makeAction(overrides?: Partial<InvocationRuleAction>): InvocationRuleAction {
  return {
    id: 'a1',
    target: 'security-review',
    ...overrides,
  };
}

function makeRule(overrides?: Partial<InvocationRule>): InvocationRule {
  return {
    id: 'r1',
    label: 'PR Review Rule',
    conditions: [makeCondition()],
    actions: [makeAction()],
    ...overrides,
  };
}

function renderBuilder(rules: InvocationRule[] = [], overrides: Record<string, unknown> = {}) {
  const onchange = mock();
  const result = render(InvocationRuleBuilder, {
    rules,
    onchange,
    fieldOptions,
    operatorOptions,
    actionOptions,
    ...overrides,
  });
  return { ...result, onchange };
}

const typedFieldOptions: InvocationRuleOption[] = [
  { value: 'retries', label: 'Retries', type: 'number' },
  { value: 'enabled', label: 'Enabled', type: 'boolean' },
  {
    value: 'severity',
    label: 'Severity',
    type: 'enum',
    options: [
      { value: 'low', label: 'Low' },
      { value: 'high', label: 'High' },
    ],
  },
  { value: 'label', label: 'Label' },
];

function renderConditionsOnlyBuilder(
  rules: InvocationRule[] = [],
  overrides: Record<string, unknown> = {},
) {
  const onchange = mock();
  const result = render(InvocationRuleBuilder, {
    rules,
    onchange,
    fieldOptions: typedFieldOptions,
    mode: 'conditions',
    ...overrides,
  });
  return { ...result, onchange };
}

function renderFlatConditionsBuilder(
  conditions: InvocationRuleCondition[] = [],
  overrides: Record<string, unknown> = {},
) {
  const onchange = mock();
  const result = render(InvocationRuleBuilder, {
    conditions,
    onchange,
    fieldOptions: typedFieldOptions,
    mode: 'flat-conditions',
    ...overrides,
  });
  return { ...result, onchange };
}

beforeEach(() => document.body.replaceChildren());
afterEach(() => cleanup());

describe('InvocationRuleBuilder', () => {
  describe('schema', () => {
    test('models readonly rules and selector options as supported input', () => {
      const ajv = new Ajv2020({ strict: false });
      const validate = ajv.compile(invocationRuleBuilderSchema);

      // `operatorOptions`/`actionOptions` are optional: they are ignored in
      // conditions-only mode, so a conditions-only configuration validates
      // without them. They remain declared properties for full-mode usage.
      // State is mode-specific: grouped modes provide `rules`, while flat mode
      // provides `conditions`, so neither state prop is globally required.
      expect(invocationRuleBuilderSchema.required).toEqual(['fieldOptions', 'readonly']);
      expect(invocationRuleBuilderSchema.properties).toHaveProperty('rules');
      expect(invocationRuleBuilderSchema.properties).toHaveProperty('conditions');
      expect(invocationRuleBuilderSchema.properties).toHaveProperty('fieldOptions');
      expect(invocationRuleBuilderSchema.properties).toHaveProperty('operatorOptions');
      expect(invocationRuleBuilderSchema.properties).toHaveProperty('actionOptions');
      expect(
        invocationRuleBuilderSchema.metadata?.unsupportedProps?.map((prop) => prop.name),
      ).toEqual(['onchange']);
      expect(invocationRuleBuilderSchema.metadata?.unsupportedProps?.[0]?.required).not.toBe(true);

      expect(
        validate({
          rules: [makeRule()],
          fieldOptions,
          operatorOptions,
          actionOptions,
          readonly: true,
        }),
      ).toBe(true);
      expect(validate.errors).toBeNull();
    });

    test('models a readonly flat conditions configuration without rule metadata', () => {
      const ajv = new Ajv2020({ strict: false });
      const validate = ajv.compile(invocationRuleBuilderSchema);

      expect(
        validate({
          conditions: [makeCondition({ operator: 'eq' })],
          fieldOptions: typedFieldOptions,
          mode: 'flat-conditions',
          readonly: true,
        }),
      ).toBe(true);
      expect(validate.errors).toBeNull();
    });

    test('rejects editable schema-driven configurations without onchange', () => {
      const ajv = new Ajv2020({ strict: false });
      const validate = ajv.compile(invocationRuleBuilderSchema);

      expect(
        validate({
          rules: [makeRule()],
          fieldOptions,
          operatorOptions,
          actionOptions,
        }),
      ).toBe(false);

      expect(
        validate({
          rules: [makeRule()],
          fieldOptions,
          operatorOptions,
          actionOptions,
          readonly: false,
        }),
      ).toBe(false);
    });
  });

  describe('structure', () => {
    test('renders root element with cinder-invocation-rule-builder class', () => {
      const { container } = renderBuilder();
      expect(container.querySelector('.cinder-invocation-rule-builder')).not.toBeNull();
    });

    test('renders as a section with aria-label', () => {
      const { container } = renderBuilder([], { label: 'My rules' });
      const section = container.querySelector('section.cinder-invocation-rule-builder');
      expect(section).not.toBeNull();
      expect(section?.getAttribute('aria-label')).toBe('My rules');
    });

    test('uses default aria-label when label prop is omitted', () => {
      const { container } = renderBuilder();
      const section = container.querySelector('.cinder-invocation-rule-builder');
      expect(section?.getAttribute('aria-label')).toBe('Invocation rules');
    });

    test('allows consumer aria-label when label prop is omitted', () => {
      const { container } = renderBuilder([], { 'aria-label': 'External rules' } as never);
      const section = container.querySelector('.cinder-invocation-rule-builder');
      expect(section?.getAttribute('aria-label')).toBe('External rules');
    });

    test('allows consumer aria-labelledby to name the region', () => {
      const { container } = renderBuilder([], { 'aria-labelledby': 'rules-heading' } as never);
      const section = container.querySelector('.cinder-invocation-rule-builder');
      expect(section?.getAttribute('aria-labelledby')).toBe('rules-heading');
      expect(section?.getAttribute('aria-label')).toBeNull();
    });

    test('renders add-rule button in editable mode', () => {
      const { container } = renderBuilder();
      expect(container.querySelector('[data-irb-add-rule]')).not.toBeNull();
    });

    test('does not render add-rule button in readonly mode', () => {
      const { container } = renderBuilder([makeRule()], { readonly: true });
      expect(container.querySelector('[data-irb-add-rule]')).toBeNull();
    });

    test('renders readonly summary when onchange is missing', () => {
      const { container } = renderBuilder([makeRule()], { onchange: undefined });

      expect(container.querySelector('[data-irb-add-rule]')).toBeNull();
      expect(
        container.querySelector('.cinder-invocation-rule-builder__rule-label-input'),
      ).toBeNull();
      expect(container.textContent).toContain('PR Review Rule');
      expect(container.textContent).toContain('Path matches "src/**"');
      expect(container.textContent).toContain('Security Review');
    });

    test('shows empty message when rules list is empty and readonly', () => {
      const { container } = renderBuilder([], { readonly: true });
      expect(container.textContent).toContain('No rules configured.');
    });

    test('renders add-rule button when rules list is empty and editable', () => {
      const { container } = renderBuilder([]);
      const addBtn = container.querySelector<HTMLButtonElement>('[data-irb-add-rule]');
      expect(addBtn).not.toBeNull();
      expect(addBtn!.tagName).toBe('BUTTON');
    });

    test('add-rule button is functional when rules list is empty', async () => {
      const { container, onchange } = renderBuilder([]);
      const addBtn = container.querySelector<HTMLElement>('[data-irb-add-rule]')!;

      await fireEvent.click(addBtn);

      expect(onchange).toHaveBeenCalledTimes(1);
      const [nextRules, change] = onchange.mock.calls[0]!;
      expect(Array.isArray(nextRules)).toBe(true);
      expect(nextRules.length).toBe(1);
      expect(change.type).toBe('add-rule');
    });

    test('merges a custom class onto the root element', () => {
      const { container } = renderBuilder([], { class: 'my-rules' });
      const root = container.querySelector('.cinder-invocation-rule-builder');
      expect(root?.classList.contains('my-rules')).toBe(true);
    });
  });

  describe('rendering rules', () => {
    test('renders a rule card for each rule', () => {
      const rules = [makeRule(), { ...makeRule(), id: 'r2', label: 'Second Rule' }];
      const { container } = renderBuilder(rules);
      expect(container.querySelectorAll('.cinder-invocation-rule-builder__rule').length).toBe(2);
    });

    test('displays rule label in the header', () => {
      const { container } = renderBuilder([makeRule()]);
      expect(
        container.querySelector<HTMLInputElement>(
          'input[aria-label="Rule name for PR Review Rule"]',
        )?.value,
      ).toBe('PR Review Rule');
    });

    test('renders condition rows for each condition', () => {
      const { container } = renderBuilder([makeRule()]);
      expect(container.querySelectorAll('.cinder-invocation-rule-builder__condition').length).toBe(
        1,
      );
    });

    test('renders action rows for each action', () => {
      const { container } = renderBuilder([makeRule()]);
      expect(container.querySelectorAll('.cinder-invocation-rule-builder__action').length).toBe(1);
    });

    test('renders editable condition and action collections as labeled lists', () => {
      const { container } = renderBuilder([makeRule()]);
      const conditions = container.querySelector('.cinder-invocation-rule-builder__conditions');
      const actions = container.querySelector('.cinder-invocation-rule-builder__actions');

      expect(conditions?.getAttribute('role')).toBe('list');
      expect(actions?.getAttribute('role')).toBe('list');
      expect(conditions?.querySelectorAll('[role="listitem"]').length).toBe(1);
      expect(actions?.querySelectorAll('[role="listitem"]').length).toBe(1);
    });

    test('condition field select reflects the current field value from props', () => {
      // Verifies that <select value={condition.field}> correctly pre-selects the option
      // matching the incoming prop — not just that options are rendered.
      const rule = makeRule({ conditions: [makeCondition({ field: 'label' })] });
      const { container } = renderBuilder([rule]);
      const fieldSelect = container.querySelector<HTMLSelectElement>(
        '[aria-label="Field for condition 1 of PR Review Rule"]',
      )!;
      expect(fieldSelect.value).toBe('label');
    });

    test('condition operator select reflects the current operator value from props', () => {
      const rule = makeRule({ conditions: [makeCondition({ operator: 'is-not' })] });
      const { container } = renderBuilder([rule]);
      const operatorSelect = container.querySelector<HTMLSelectElement>(
        '[aria-label="Operator for condition 1 of PR Review Rule"]',
      )!;
      expect(operatorSelect.value).toBe('is-not');
    });

    test('action target select reflects the current target value from props', () => {
      const rule = makeRule({ actions: [makeAction({ target: 'code-review' })] });
      const { container } = renderBuilder([rule]);
      const targetSelect = container.querySelector<HTMLSelectElement>(
        '[aria-label="Action 1 target for PR Review Rule"]',
      )!;
      expect(targetSelect.value).toBe('code-review');
    });
  });

  describe('behavior', () => {
    test('add-rule button calls onchange with add-rule change', async () => {
      const { container, onchange } = renderBuilder();
      const addBtn = container.querySelector<HTMLElement>('[data-irb-add-rule]')!;

      await fireEvent.click(addBtn);

      expect(onchange).toHaveBeenCalledTimes(1);
      const [nextRules, change] = onchange.mock.calls[0]!;
      expect(Array.isArray(nextRules)).toBe(true);
      expect(nextRules.length).toBe(1);
      expect(change.type).toBe('add-rule');
      expect(typeof change.ruleId).toBe('string');
    });

    test('remove-rule button calls onchange with remove-rule change', async () => {
      const { container, onchange } = renderBuilder([makeRule()]);
      const removeBtn = container.querySelector<HTMLElement>('[data-irb-rule-remove]')!;

      await fireEvent.click(removeBtn);

      expect(onchange).toHaveBeenCalledTimes(1);
      const [nextRules, change] = onchange.mock.calls[0]!;
      expect(nextRules.length).toBe(0);
      expect(change.type).toBe('remove-rule');
      expect(change.ruleId).toBe('r1');
    });

    test('editing a rule name keeps the draft value until blur commits it', async () => {
      const { container, onchange } = renderBuilder([makeRule()]);
      const ruleNameInput = container.querySelector<HTMLInputElement>(
        '[aria-label="Rule name for PR Review Rule"]',
      )!;

      await fireEvent.input(ruleNameInput, { target: { value: 'Security Rule' } });

      expect(ruleNameInput.value).toBe('Security Rule');
      expect(onchange).not.toHaveBeenCalled();

      await fireEvent.blur(ruleNameInput);

      expect(onchange).toHaveBeenCalledTimes(1);
      const [nextRules, change] = onchange.mock.calls[0]!;
      expect(nextRules[0].label).toBe('Security Rule');
      expect(change.type).toBe('rename-rule');
      expect(change.ruleId).toBe('r1');
    });

    test('blurring an unchanged rule name does not emit a rename change', async () => {
      const { container, onchange } = renderBuilder([makeRule()]);
      const ruleNameInput = container.querySelector<HTMLInputElement>(
        '[aria-label="Rule name for PR Review Rule"]',
      )!;

      await fireEvent.blur(ruleNameInput);

      expect(onchange).not.toHaveBeenCalled();
    });

    test('external rule label updates clear stale in-progress drafts', async () => {
      const rule = makeRule();
      const { container, rerender } = renderBuilder([rule]);
      const ruleNameInput = container.querySelector<HTMLInputElement>(
        '[aria-label="Rule name for PR Review Rule"]',
      )!;

      await fireEvent.input(ruleNameInput, { target: { value: 'Draft label' } });
      expect(ruleNameInput.value).toBe('Draft label');

      await rerender({
        rules: [{ ...rule, label: 'Server label' }],
        fieldOptions,
        operatorOptions,
        actionOptions,
        onchange: () => {},
      });

      const updatedInput = container.querySelector<HTMLInputElement>(
        '[aria-label="Rule name for Server label"]',
      )!;
      expect(updatedInput.value).toBe('Server label');
    });

    test('add-condition button calls onchange with add-condition change', async () => {
      const { container, onchange } = renderBuilder([makeRule()]);
      const addCondBtn = container.querySelector<HTMLElement>('[data-irb-add-condition]')!;

      await fireEvent.click(addCondBtn);

      expect(onchange).toHaveBeenCalledTimes(1);
      const [nextRules, change] = onchange.mock.calls[0]!;
      expect(nextRules[0].conditions.length).toBe(2);
      expect(change.type).toBe('add-condition');
      expect(change.ruleId).toBe('r1');
    });

    test('remove-condition button calls onchange with remove-condition change', async () => {
      const { container, onchange } = renderBuilder([makeRule()]);
      const removeCondBtn = container.querySelector<HTMLElement>('[data-irb-condition-remove]')!;

      await fireEvent.click(removeCondBtn);

      expect(onchange).toHaveBeenCalledTimes(1);
      const [nextRules, change] = onchange.mock.calls[0]!;
      expect(nextRules[0].conditions.length).toBe(0);
      expect(change.type).toBe('remove-condition');
      expect(change.ruleId).toBe('r1');
      expect(change.conditionId).toBe('c1');
    });

    test('add-action button calls onchange with add-action change', async () => {
      const { container, onchange } = renderBuilder([makeRule()]);
      const addActionBtn = container.querySelector<HTMLElement>('[data-irb-add-action]')!;

      await fireEvent.click(addActionBtn);

      expect(onchange).toHaveBeenCalledTimes(1);
      const [nextRules, change] = onchange.mock.calls[0]!;
      expect(nextRules[0].actions.length).toBe(2);
      expect(change.type).toBe('add-action');
      expect(change.ruleId).toBe('r1');
    });

    test('remove-action button calls onchange with remove-action change', async () => {
      const { container, onchange } = renderBuilder([makeRule()]);
      const removeActionBtn = container.querySelector<HTMLElement>('[data-irb-action-remove]')!;

      await fireEvent.click(removeActionBtn);

      expect(onchange).toHaveBeenCalledTimes(1);
      const [nextRules, change] = onchange.mock.calls[0]!;
      expect(nextRules[0].actions.length).toBe(0);
      expect(change.type).toBe('remove-action');
      expect(change.ruleId).toBe('r1');
      expect(change.actionId).toBe('a1');
    });

    test('updating condition field calls onchange with update-condition change', async () => {
      const { container, onchange } = renderBuilder([makeRule()]);
      const fieldSelect = container.querySelector<HTMLSelectElement>(
        '[aria-label="Field for condition 1 of PR Review Rule"]',
      )!;

      await fireEvent.change(fieldSelect, { target: { value: 'label' } });

      expect(onchange).toHaveBeenCalledTimes(1);
      const [nextRules, change] = onchange.mock.calls[0]!;
      expect(nextRules[0].conditions[0].field).toBe('label');
      expect(change.type).toBe('update-condition');
      expect(change.field).toBe('field');
    });

    test('updating condition operator calls onchange with update-condition change', async () => {
      const { container, onchange } = renderBuilder([makeRule()]);
      const operatorSelect = container.querySelector<HTMLSelectElement>(
        '[aria-label="Operator for condition 1 of PR Review Rule"]',
      )!;

      await fireEvent.change(operatorSelect, { target: { value: 'is-not' } });

      expect(onchange).toHaveBeenCalledTimes(1);
      const [nextRules, change] = onchange.mock.calls[0]!;
      expect(nextRules[0].conditions[0].operator).toBe('is-not');
      expect(change.field).toBe('operator');
    });

    test('updating condition value calls onchange with update-condition change', async () => {
      const { container, onchange } = renderBuilder([makeRule()]);
      const valueInput = container.querySelector<HTMLInputElement>(
        '[aria-label="Value for condition 1 of PR Review Rule"]',
      )!;

      await fireEvent.input(valueInput, { target: { value: 'packages/**' } });

      expect(onchange).toHaveBeenCalledTimes(1);
      const [nextRules, change] = onchange.mock.calls[0]!;
      expect(nextRules[0].conditions[0].value).toBe('packages/**');
      expect(change.field).toBe('value');
    });

    test('updating action target calls onchange with update-action change', async () => {
      const { container, onchange } = renderBuilder([makeRule()]);
      const targetSelect = container.querySelector<HTMLSelectElement>(
        '[aria-label="Action 1 target for PR Review Rule"]',
      )!;

      await fireEvent.change(targetSelect, { target: { value: 'code-review' } });

      expect(onchange).toHaveBeenCalledTimes(1);
      const [nextRules, change] = onchange.mock.calls[0]!;
      expect(nextRules[0].actions[0].target).toBe('code-review');
      expect(change.type).toBe('update-action');
    });

    test('move-rule-down button calls onchange with move-rule change', async () => {
      const rules = [makeRule(), { ...makeRule(), id: 'r2', label: 'Second Rule' }];
      const { container, onchange } = renderBuilder(rules);
      const moveDownBtn = container.querySelector<HTMLElement>(
        '[aria-label="Move PR Review Rule down"]',
      )!;

      await fireEvent.click(moveDownBtn);

      expect(onchange).toHaveBeenCalledTimes(1);
      const [nextRules, change] = onchange.mock.calls[0]!;
      expect(nextRules[0].id).toBe('r2');
      expect(nextRules[1].id).toBe('r1');
      expect(change.type).toBe('move-rule');
      expect(change.fromIndex).toBe(0);
      expect(change.toIndex).toBe(1);
    });

    test('move-rule-up button is disabled for the first rule', () => {
      const { container } = renderBuilder([makeRule()]);
      const moveUpBtn = container.querySelector<HTMLButtonElement>(
        '[aria-label="Move PR Review Rule up"]',
      )!;
      expect(moveUpBtn.disabled).toBe(true);
    });

    test('move-rule-down button is disabled for the last rule', () => {
      const { container } = renderBuilder([makeRule()]);
      const moveDownBtn = container.querySelector<HTMLButtonElement>(
        '[aria-label="Move PR Review Rule down"]',
      )!;
      expect(moveDownBtn.disabled).toBe(true);
    });

    test('does not mutate the input rules array on add-condition', async () => {
      const originalRules = [makeRule()];
      const originalConditionsRef = originalRules[0]!.conditions;
      const { container, onchange } = renderBuilder(originalRules);

      const addCondBtn = container.querySelector<HTMLElement>('[data-irb-add-condition]')!;
      await fireEvent.click(addCondBtn);

      const [nextRules] = onchange.mock.calls[0]!;
      expect(nextRules).not.toBe(originalRules);
      expect(nextRules[0]).not.toBe(originalRules[0]);
      expect(originalRules[0]!.conditions).toBe(originalConditionsRef);
      expect(originalRules[0]!.conditions.length).toBe(1);
    });
  });

  describe('readonly mode', () => {
    test('renders condition summaries as text in readonly mode', () => {
      const { container } = renderBuilder([makeRule()], { readonly: true });
      // Should show field, operator, value text
      expect(container.textContent).toContain('Path');
      expect(container.textContent).toContain('matches');
      expect(container.textContent).toContain('src/**');
    });

    test('renders action summaries as text in readonly mode', () => {
      const { container } = renderBuilder([makeRule()], { readonly: true });
      expect(container.textContent).toContain('Security Review');
    });

    test('does not render any editable controls in readonly mode', () => {
      const { container } = renderBuilder([makeRule()], { readonly: true });
      expect(container.querySelector('select')).toBeNull();
      expect(container.querySelector('input')).toBeNull();
      expect(container.querySelector('[data-irb-condition-remove]')).toBeNull();
      expect(container.querySelector('[data-irb-action-remove]')).toBeNull();
    });

    test('shows empty messages for rules with no conditions/actions in readonly mode', () => {
      const emptyRule: InvocationRule = {
        id: 'r1',
        label: 'Empty Rule',
        conditions: [],
        actions: [],
      };
      const { container } = renderBuilder([emptyRule], { readonly: true });
      expect(container.textContent).toContain('No conditions');
      expect(container.textContent).toContain('No actions configured');
    });
  });

  describe('accessibility', () => {
    test('condition field select has descriptive aria-label', () => {
      const { container } = renderBuilder([makeRule()]);
      const fieldSelect = container.querySelector(
        '[aria-label="Field for condition 1 of PR Review Rule"]',
      );
      expect(fieldSelect).not.toBeNull();
    });

    test('condition operator select has descriptive aria-label', () => {
      const { container } = renderBuilder([makeRule()]);
      const operatorSelect = container.querySelector(
        '[aria-label="Operator for condition 1 of PR Review Rule"]',
      );
      expect(operatorSelect).not.toBeNull();
    });

    test('condition value input has descriptive aria-label', () => {
      const { container } = renderBuilder([makeRule()]);
      const valueInput = container.querySelector(
        '[aria-label="Value for condition 1 of PR Review Rule"]',
      );
      expect(valueInput).not.toBeNull();
    });

    test('empty condition value is not marked invalid by the builder', () => {
      const rule = makeRule({ conditions: [makeCondition({ value: '' })] });
      const { container } = renderBuilder([rule]);
      const valueInput = container.querySelector(
        '[aria-label="Value for condition 1 of PR Review Rule"]',
      );
      expect(valueInput?.hasAttribute('aria-invalid')).toBe(false);
    });

    test('condition remove button has descriptive aria-label', () => {
      const { container } = renderBuilder([makeRule()]);
      const removeBtn = container.querySelector(
        '[aria-label="Remove condition 1 of PR Review Rule"]',
      );
      expect(removeBtn).not.toBeNull();
    });

    test('action target select has descriptive aria-label', () => {
      const { container } = renderBuilder([makeRule()]);
      const targetSelect = container.querySelector(
        '[aria-label="Action 1 target for PR Review Rule"]',
      );
      expect(targetSelect).not.toBeNull();
    });

    test('action remove button has descriptive aria-label', () => {
      const { container } = renderBuilder([makeRule()]);
      const removeBtn = container.querySelector('[aria-label="Remove action 1 of PR Review Rule"]');
      expect(removeBtn).not.toBeNull();
    });

    test('rule move-up button has descriptive aria-label', () => {
      const { container } = renderBuilder([makeRule()]);
      const moveBtn = container.querySelector('[aria-label="Move PR Review Rule up"]');
      expect(moveBtn).not.toBeNull();
    });

    test('rule move-down button has descriptive aria-label', () => {
      const { container } = renderBuilder([makeRule()]);
      const moveBtn = container.querySelector('[aria-label="Move PR Review Rule down"]');
      expect(moveBtn).not.toBeNull();
    });

    test('rule remove button has descriptive aria-label', () => {
      const { container } = renderBuilder([makeRule()]);
      const removeBtn = container.querySelector('[aria-label="Remove PR Review Rule"]');
      expect(removeBtn).not.toBeNull();
    });

    test('live region is present in the DOM', () => {
      renderBuilder([makeRule()]);
      // The live region is outside the component section so look in baseElement
      const liveRegion = document.querySelector('[role="status"][aria-live="polite"]');
      expect(liveRegion).not.toBeNull();
    });

    test('condition list has accessible label via aria-labelledby', () => {
      const { container } = renderBuilder([makeRule()]);
      const conditionsList = container.querySelector('.cinder-invocation-rule-builder__conditions');
      const labelId = conditionsList?.getAttribute('aria-labelledby');
      expect(labelId).toBeTruthy();
      const labelEl = container.querySelector(`#${labelId}`);
      expect(labelEl?.textContent?.trim()).toBe('Conditions');
      expect(conditionsList?.getAttribute('role')).toBe('list');
    });

    test('actions list has accessible label via aria-labelledby', () => {
      const { container } = renderBuilder([makeRule()]);
      const actionsList = container.querySelector('.cinder-invocation-rule-builder__actions');
      const labelId = actionsList?.getAttribute('aria-labelledby');
      expect(labelId).toBeTruthy();
      const labelEl = container.querySelector(`#${labelId}`);
      expect(labelEl?.textContent?.trim()).toBe('Actions');
      expect(actionsList?.getAttribute('role')).toBe('list');
    });

    /**
     * Keyboard activation is guaranteed by construction — every interactive control
     * is rendered as `<button type="button">`.  Native `<button>` elements fire a
     * click event on Space and Enter without any JS handler, so asserting the element
     * type is a more honest and reliable proof than synthesising keydown events in
     * happy-dom (which does NOT dispatch a synthetic click on keydown the way real
     * browsers do).
     */
    test('keyboard: add-condition control is a native button (guarantees Enter/Space activation)', () => {
      const { container } = renderBuilder([makeRule()]);
      const addCondBtn = container.querySelector<HTMLElement>('[data-irb-add-condition]')!;
      expect(addCondBtn.tagName).toBe('BUTTON');
      expect((addCondBtn as HTMLButtonElement).type).toBe('button');
    });

    test('keyboard: add-action control is a native button (guarantees Enter/Space activation)', () => {
      const { container } = renderBuilder([makeRule()]);
      const addActionBtn = container.querySelector<HTMLElement>('[data-irb-add-action]')!;
      expect(addActionBtn.tagName).toBe('BUTTON');
      expect((addActionBtn as HTMLButtonElement).type).toBe('button');
    });

    test('keyboard: remove-condition control is a native button (guarantees Enter/Space activation)', () => {
      const { container } = renderBuilder([makeRule()]);
      const removeBtn = container.querySelector<HTMLElement>('[data-irb-condition-remove]')!;
      expect(removeBtn.tagName).toBe('BUTTON');
      expect((removeBtn as HTMLButtonElement).type).toBe('button');
    });

    test('keyboard: remove-action control is a native button (guarantees Enter/Space activation)', () => {
      const { container } = renderBuilder([makeRule()]);
      const removeBtn = container.querySelector<HTMLElement>('[data-irb-action-remove]')!;
      expect(removeBtn.tagName).toBe('BUTTON');
      expect((removeBtn as HTMLButtonElement).type).toBe('button');
    });

    test('keyboard: add-rule control is a native button (guarantees Enter/Space activation)', () => {
      const { container } = renderBuilder();
      const addBtn = container.querySelector<HTMLElement>('[data-irb-add-rule]')!;
      expect(addBtn.tagName).toBe('BUTTON');
      expect((addBtn as HTMLButtonElement).type).toBe('button');
    });
  });

  describe('conditions-only mode', () => {
    test('defaults to full mode (conditions + actions) when the mode prop is omitted', () => {
      const { container } = renderBuilder([makeRule()]);
      expect(container.querySelector('[data-irb-add-action]')).not.toBeNull();
      expect(container.textContent).toContain('Actions');
    });

    test('hides action controls entirely in editable conditions-only mode', () => {
      const rule = makeRule({ conditions: [makeCondition({ field: 'label' })] });
      const { container } = renderConditionsOnlyBuilder([rule]);
      expect(container.querySelector('[data-irb-add-action]')).toBeNull();
      expect(container.querySelector('[data-irb-action-remove]')).toBeNull();
      expect(container.querySelector('select[aria-label*="target"]')).toBeNull();
      expect(container.querySelector('.cinder-invocation-rule-builder__actions')).toBeNull();
      expect(container.textContent).not.toContain('Actions');
    });

    test('hides the action summary entirely in readonly conditions-only mode', () => {
      const rule = makeRule({ conditions: [makeCondition({ field: 'label' })] });
      const { container } = renderConditionsOnlyBuilder([rule], {
        readonly: true,
        onchange: undefined,
      });
      expect(container.textContent).not.toContain('Actions');
      expect(container.textContent).not.toContain('No actions configured.');
    });

    test('constrains the operator select to the fixed eq/gt/lt/gte/lte set with default labels', () => {
      const rule = makeRule({ conditions: [makeCondition({ field: 'label', operator: 'eq' })] });
      const { container } = renderConditionsOnlyBuilder([rule]);
      const operatorSelect = container.querySelector<HTMLSelectElement>(
        '[aria-label="Operator for condition 1 of PR Review Rule"]',
      )!;
      const values = Array.from(operatorSelect.options).map((option) => option.value);
      expect(values).toEqual(['eq', 'gt', 'lt', 'gte', 'lte']);
      expect(operatorSelect.options[0]?.textContent).toBe('equals');
    });

    test('ignores a consumer-supplied operatorOptions prop in conditions-only mode', () => {
      const rule = makeRule({ conditions: [makeCondition({ field: 'label', operator: 'eq' })] });
      const { container } = renderConditionsOnlyBuilder([rule], {
        operatorOptions: [{ value: 'custom', label: 'Custom operator' }],
      });
      const operatorSelect = container.querySelector<HTMLSelectElement>(
        '[aria-label="Operator for condition 1 of PR Review Rule"]',
      )!;
      const values = Array.from(operatorSelect.options).map((option) => option.value);
      expect(values).toEqual(['eq', 'gt', 'lt', 'gte', 'lte']);
    });

    test('add-condition seeds the new condition with the fixed operator set default (eq)', async () => {
      const rule = makeRule({ conditions: [] });
      const { container, onchange } = renderConditionsOnlyBuilder([rule]);
      const addCondBtn = container.querySelector<HTMLElement>('[data-irb-add-condition]')!;

      await fireEvent.click(addCondBtn);

      expect(onchange).toHaveBeenCalledTimes(1);
      const [nextRules] = onchange.mock.calls[0]!;
      expect(nextRules[0].conditions[0].operator).toBe('eq');
    });

    test('renders a numeric input for a number-typed field', () => {
      const rule = makeRule({ conditions: [makeCondition({ field: 'retries', value: '3' })] });
      const { container } = renderConditionsOnlyBuilder([rule]);
      const valueInput = container.querySelector<HTMLInputElement>(
        '[aria-label="Value for condition 1 of PR Review Rule"]',
      )!;
      expect(valueInput.tagName).toBe('INPUT');
      expect(valueInput.type).toBe('number');
      expect(valueInput.value).toBe('3');
    });

    test('renders a checkbox for a boolean-typed field', () => {
      const rule = makeRule({ conditions: [makeCondition({ field: 'enabled', value: 'true' })] });
      const { container } = renderConditionsOnlyBuilder([rule]);
      const valueInput = container.querySelector<HTMLInputElement>(
        '[aria-label="Value for condition 1 of PR Review Rule"]',
      )!;
      expect(valueInput.tagName).toBe('INPUT');
      expect(valueInput.type).toBe('checkbox');
      expect(valueInput.checked).toBe(true);
    });

    test('renders a select with declared options for an enum-typed field', () => {
      const rule = makeRule({ conditions: [makeCondition({ field: 'severity', value: 'high' })] });
      const { container } = renderConditionsOnlyBuilder([rule]);
      const valueSelect = container.querySelector<HTMLSelectElement>(
        '[aria-label="Value for condition 1 of PR Review Rule"]',
      )!;
      expect(valueSelect.tagName).toBe('SELECT');
      expect(valueSelect.value).toBe('high');
      const optionValues = Array.from(valueSelect.options).map((option) => option.value);
      expect(optionValues).toEqual(['low', 'high']);
    });

    test('renders a text input for a string-typed (or untyped) field', () => {
      const rule = makeRule({ conditions: [makeCondition({ field: 'label', value: 'foo' })] });
      const { container } = renderConditionsOnlyBuilder([rule]);
      const valueInput = container.querySelector<HTMLInputElement>(
        '[aria-label="Value for condition 1 of PR Review Rule"]',
      )!;
      expect(valueInput.tagName).toBe('INPUT');
      expect(valueInput.type).toBe('text');
    });

    test('editing a numeric condition value emits update-condition with the raw string value', async () => {
      const rule = makeRule({ conditions: [makeCondition({ field: 'retries', value: '3' })] });
      const { container, onchange } = renderConditionsOnlyBuilder([rule]);
      const valueInput = container.querySelector<HTMLInputElement>(
        '[aria-label="Value for condition 1 of PR Review Rule"]',
      )!;

      await fireEvent.input(valueInput, { target: { value: '5' } });

      expect(onchange).toHaveBeenCalledTimes(1);
      const [nextRules, change] = onchange.mock.calls[0]!;
      expect(nextRules[0].conditions[0].value).toBe('5');
      expect(change.type).toBe('update-condition');
      expect(change.field).toBe('value');
    });

    test('toggling a boolean condition value emits update-condition with a stringified boolean', async () => {
      const rule = makeRule({ conditions: [makeCondition({ field: 'enabled', value: 'false' })] });
      const { container, onchange } = renderConditionsOnlyBuilder([rule]);
      const valueInput = container.querySelector<HTMLInputElement>(
        '[aria-label="Value for condition 1 of PR Review Rule"]',
      )!;

      await fireEvent.click(valueInput);

      expect(onchange).toHaveBeenCalledTimes(1);
      const [nextRules, change] = onchange.mock.calls[0]!;
      expect(nextRules[0].conditions[0].value).toBe('true');
      expect(change.type).toBe('update-condition');
      expect(change.field).toBe('value');
    });

    test('selecting an enum condition value emits update-condition with the chosen option value', async () => {
      const rule = makeRule({ conditions: [makeCondition({ field: 'severity', value: 'low' })] });
      const { container, onchange } = renderConditionsOnlyBuilder([rule]);
      const valueSelect = container.querySelector<HTMLSelectElement>(
        '[aria-label="Value for condition 1 of PR Review Rule"]',
      )!;

      await fireEvent.change(valueSelect, { target: { value: 'high' } });

      expect(onchange).toHaveBeenCalledTimes(1);
      const [nextRules, change] = onchange.mock.calls[0]!;
      expect(nextRules[0].conditions[0].value).toBe('high');
      expect(change.type).toBe('update-condition');
      expect(change.field).toBe('value');
    });

    test('rules created in conditions-only mode start with an empty actions array and no action descriptors are ever emitted', async () => {
      const { container, onchange } = renderConditionsOnlyBuilder([]);
      const addRuleBtn = container.querySelector<HTMLElement>('[data-irb-add-rule]')!;

      await fireEvent.click(addRuleBtn);

      expect(onchange).toHaveBeenCalledTimes(1);
      const [nextRules, change] = onchange.mock.calls[0]!;
      expect(nextRules[0].actions).toEqual([]);
      expect(['add-action', 'remove-action', 'update-action']).not.toContain(change.type);
    });

    test('readonly conditions-only summary shows condition text but never an actions section', () => {
      const rule = makeRule({
        conditions: [makeCondition({ field: 'label', value: 'foo' })],
      });
      const { container } = renderConditionsOnlyBuilder([rule], {
        readonly: true,
        onchange: undefined,
      });
      expect(container.textContent).toContain('Label');
      expect(container.textContent).toContain('foo');
      expect(container.textContent).not.toContain('Actions');
    });

    describe('typed default value on add', () => {
      test('seeds a boolean field with "false" (matches the unchecked checkbox)', async () => {
        const rule = makeRule({ conditions: [] });
        const { container, onchange } = renderConditionsOnlyBuilder([rule], {
          fieldOptions: [{ value: 'enabled', label: 'Enabled', type: 'boolean' }],
        });
        const addCondBtn = container.querySelector<HTMLElement>('[data-irb-add-condition]')!;

        await fireEvent.click(addCondBtn);

        const [nextRules] = onchange.mock.calls[0]!;
        expect(nextRules[0].conditions[0].value).toBe('false');
      });

      test('seeds an enum field with its first choice (matches the pre-selected select option)', async () => {
        const rule = makeRule({ conditions: [] });
        const { container, onchange } = renderConditionsOnlyBuilder([rule], {
          fieldOptions: [
            {
              value: 'severity',
              label: 'Severity',
              type: 'enum',
              options: [
                { value: 'low', label: 'Low' },
                { value: 'high', label: 'High' },
              ],
            },
          ],
        });
        const addCondBtn = container.querySelector<HTMLElement>('[data-irb-add-condition]')!;

        await fireEvent.click(addCondBtn);

        const [nextRules] = onchange.mock.calls[0]!;
        expect(nextRules[0].conditions[0].value).toBe('low');
      });

      test('seeds a number field with an empty value', async () => {
        const rule = makeRule({ conditions: [] });
        const { container, onchange } = renderConditionsOnlyBuilder([rule], {
          fieldOptions: [{ value: 'retries', label: 'Retries', type: 'number' }],
        });
        const addCondBtn = container.querySelector<HTMLElement>('[data-irb-add-condition]')!;

        await fireEvent.click(addCondBtn);

        const [nextRules] = onchange.mock.calls[0]!;
        expect(nextRules[0].conditions[0].value).toBe('');
      });

      test('seeds a string (or untyped) field with an empty value', async () => {
        const rule = makeRule({ conditions: [] });
        const { container, onchange } = renderConditionsOnlyBuilder([rule], {
          fieldOptions: [{ value: 'label', label: 'Label' }],
        });
        const addCondBtn = container.querySelector<HTMLElement>('[data-irb-add-condition]')!;

        await fireEvent.click(addCondBtn);

        const [nextRules] = onchange.mock.calls[0]!;
        expect(nextRules[0].conditions[0].value).toBe('');
      });
    });

    describe('typed value reset on field change', () => {
      test('resets a stale value to "false" when the field changes to boolean', async () => {
        const rule = makeRule({ conditions: [makeCondition({ field: 'label', value: 'foobar' })] });
        const { container, onchange } = renderConditionsOnlyBuilder([rule]);
        const fieldSelect = container.querySelector<HTMLSelectElement>(
          '[aria-label="Field for condition 1 of PR Review Rule"]',
        )!;

        await fireEvent.change(fieldSelect, { target: { value: 'enabled' } });

        expect(onchange).toHaveBeenCalledTimes(1);
        const [nextRules, change] = onchange.mock.calls[0]!;
        expect(nextRules[0].conditions[0].field).toBe('enabled');
        expect(nextRules[0].conditions[0].value).toBe('false');
        expect(change.type).toBe('update-condition');
        expect(change.field).toBe('field');
      });

      test('resets a value outside the new choices to the first choice when the field changes to enum', async () => {
        const rule = makeRule({ conditions: [makeCondition({ field: 'label', value: 'foobar' })] });
        const { container, onchange } = renderConditionsOnlyBuilder([rule]);
        const fieldSelect = container.querySelector<HTMLSelectElement>(
          '[aria-label="Field for condition 1 of PR Review Rule"]',
        )!;

        await fireEvent.change(fieldSelect, { target: { value: 'severity' } });

        const [nextRules] = onchange.mock.calls[0]!;
        expect(nextRules[0].conditions[0].value).toBe('low');
      });

      test('keeps the existing value when the field changes to an enum field whose choices already include it', async () => {
        const rule = makeRule({ conditions: [makeCondition({ field: 'label', value: 'high' })] });
        const { container, onchange } = renderConditionsOnlyBuilder([rule]);
        const fieldSelect = container.querySelector<HTMLSelectElement>(
          '[aria-label="Field for condition 1 of PR Review Rule"]',
        )!;

        await fireEvent.change(fieldSelect, { target: { value: 'severity' } });

        const [nextRules] = onchange.mock.calls[0]!;
        expect(nextRules[0].conditions[0].value).toBe('high');
      });

      test('resets a non-numeric value to empty when the field changes to number', async () => {
        const rule = makeRule({ conditions: [makeCondition({ field: 'label', value: 'foobar' })] });
        const { container, onchange } = renderConditionsOnlyBuilder([rule]);
        const fieldSelect = container.querySelector<HTMLSelectElement>(
          '[aria-label="Field for condition 1 of PR Review Rule"]',
        )!;

        await fireEvent.change(fieldSelect, { target: { value: 'retries' } });

        const [nextRules] = onchange.mock.calls[0]!;
        expect(nextRules[0].conditions[0].value).toBe('');
      });

      test('keeps an existing numeric-looking value when the field changes to number', async () => {
        const rule = makeRule({ conditions: [makeCondition({ field: 'label', value: '7' })] });
        const { container, onchange } = renderConditionsOnlyBuilder([rule]);
        const fieldSelect = container.querySelector<HTMLSelectElement>(
          '[aria-label="Field for condition 1 of PR Review Rule"]',
        )!;

        await fireEvent.change(fieldSelect, { target: { value: 'retries' } });

        const [nextRules] = onchange.mock.calls[0]!;
        expect(nextRules[0].conditions[0].value).toBe('7');
      });

      test('keeps the existing value when the field changes between two fields of the same (string) type', async () => {
        const rule = makeRule({ conditions: [makeCondition({ field: 'label', value: 'foobar' })] });
        const { container, onchange } = renderConditionsOnlyBuilder([rule], {
          fieldOptions: [...typedFieldOptions, { value: 'owner', label: 'Owner' }],
        });
        const fieldSelect = container.querySelector<HTMLSelectElement>(
          '[aria-label="Field for condition 1 of PR Review Rule"]',
        )!;

        await fireEvent.change(fieldSelect, { target: { value: 'owner' } });

        const [nextRules] = onchange.mock.calls[0]!;
        expect(nextRules[0].conditions[0].value).toBe('foobar');
      });

      test('full mode never resets the condition value when the field changes (conditions-only-only behavior)', async () => {
        const rule = makeRule({ conditions: [makeCondition({ field: 'path', value: 'src/**' })] });
        const { container, onchange } = renderBuilder([rule]);
        const fieldSelect = container.querySelector<HTMLSelectElement>(
          '[aria-label="Field for condition 1 of PR Review Rule"]',
        )!;

        await fireEvent.change(fieldSelect, { target: { value: 'label' } });

        const [nextRules] = onchange.mock.calls[0]!;
        expect(nextRules[0].conditions[0].value).toBe('src/**');
      });
    });

    describe('stripping hidden actions', () => {
      test('emits actions: [] for a rule that arrives with actions and is then edited in conditions-only mode', async () => {
        const ruleWithActions = makeRule({
          conditions: [makeCondition({ field: 'label', value: 'foo' })],
          actions: [makeAction()],
        });
        const { container, onchange } = renderConditionsOnlyBuilder([ruleWithActions]);
        const addCondBtn = container.querySelector<HTMLElement>('[data-irb-add-condition]')!;

        await fireEvent.click(addCondBtn);

        expect(onchange).toHaveBeenCalledTimes(1);
        const [nextRules] = onchange.mock.calls[0]!;
        expect(nextRules[0].actions).toEqual([]);
      });

      test('strips actions from every rule in the emitted array, not only the edited one', async () => {
        const editedRule = makeRule({
          id: 'r1',
          conditions: [makeCondition({ field: 'label', value: 'foo' })],
          actions: [makeAction()],
        });
        const untouchedRule = makeRule({
          id: 'r2',
          label: 'Second Rule',
          conditions: [makeCondition({ id: 'c2', field: 'label', value: 'bar' })],
          actions: [makeAction({ id: 'a2' })],
        });
        const { container, onchange } = renderConditionsOnlyBuilder([editedRule, untouchedRule]);
        const addCondBtn = container.querySelectorAll<HTMLElement>('[data-irb-add-condition]')[0]!;

        await fireEvent.click(addCondBtn);

        const [nextRules] = onchange.mock.calls[0]!;
        expect(nextRules[0].actions).toEqual([]);
        expect(nextRules[1].actions).toEqual([]);
      });

      test('full mode still preserves actions on edit (does not strip them)', async () => {
        const rule = makeRule({ actions: [makeAction()] });
        const { container, onchange } = renderBuilder([rule]);
        const addCondBtn = container.querySelector<HTMLElement>('[data-irb-add-condition]')!;

        await fireEvent.click(addCondBtn);

        const [nextRules] = onchange.mock.calls[0]!;
        expect(nextRules[0].actions).toEqual([makeAction()]);
      });
    });

    describe('normalizing unsupported operators', () => {
      test('coerces a leftover full-mode operator to "eq" (and strips actions) when a rule carrying it is edited in conditions-only mode', async () => {
        const ruleWithLegacyOperator = makeRule({
          conditions: [makeCondition({ field: 'label', operator: 'matches', value: 'foo' })],
          actions: [makeAction()],
        });
        const { container, onchange } = renderConditionsOnlyBuilder([ruleWithLegacyOperator]);
        const addCondBtn = container.querySelector<HTMLElement>('[data-irb-add-condition]')!;

        await fireEvent.click(addCondBtn);

        expect(onchange).toHaveBeenCalledTimes(1);
        const [nextRules] = onchange.mock.calls[0]!;
        expect(nextRules[0].conditions[0].operator).toBe('eq');
        expect(nextRules[0].actions).toEqual([]);
      });

      test('leaves an already-valid conditions-only operator untouched', async () => {
        const rule = makeRule({
          conditions: [makeCondition({ field: 'label', operator: 'gte', value: 'foo' })],
        });
        const { container, onchange } = renderConditionsOnlyBuilder([rule]);
        const addCondBtn = container.querySelector<HTMLElement>('[data-irb-add-condition]')!;

        await fireEvent.click(addCondBtn);

        const [nextRules] = onchange.mock.calls[0]!;
        expect(nextRules[0].conditions[0].operator).toBe('gte');
      });

      test('full mode never coerces condition operators (conditions-only-only behavior)', async () => {
        const rule = makeRule({
          conditions: [makeCondition({ field: 'path', operator: 'matches', value: 'src/**' })],
        });
        const { container, onchange } = renderBuilder([rule]);
        const addCondBtn = container.querySelector<HTMLElement>('[data-irb-add-condition]')!;

        await fireEvent.click(addCondBtn);

        const [nextRules] = onchange.mock.calls[0]!;
        expect(nextRules[0].conditions[0].operator).toBe('matches');
      });

      test('displays the "eq" label in the readonly summary for a legacy operator, before any edit', () => {
        const rule = makeRule({
          conditions: [makeCondition({ field: 'label', operator: 'matches', value: 'foo' })],
        });
        const { container } = renderConditionsOnlyBuilder([rule], {
          readonly: true,
          onchange: undefined,
        });

        expect(container.textContent).toContain('equals');
        expect(container.textContent).not.toContain('matches');
      });

      test('the editable operator select shows "eq" selected for a legacy operator, before any edit', () => {
        const rule = makeRule({
          conditions: [makeCondition({ field: 'label', operator: 'matches', value: 'foo' })],
        });
        const { container } = renderConditionsOnlyBuilder([rule]);
        const operatorSelect = container.querySelector<HTMLSelectElement>(
          '[aria-label="Operator for condition 1 of PR Review Rule"]',
        )!;

        expect(operatorSelect.value).toBe('eq');
        expect(operatorSelect.selectedOptions[0]?.value).toBe('eq');
      });

      test('full mode readonly summary displays the raw operator label unchanged, before any edit', () => {
        const rule = makeRule({
          conditions: [makeCondition({ field: 'path', operator: 'matches', value: 'src/**' })],
        });
        const { container } = renderBuilder([rule], { readonly: true, onchange: undefined });

        expect(container.textContent).toContain('matches');
      });
    });

    describe('normalizing unsupported condition values', () => {
      test('coerces a value invalid for its field type when the rule is edited via an unrelated change (renaming the rule)', async () => {
        const rule = makeRule({
          conditions: [
            makeCondition({ id: 'c1', field: 'enabled', operator: 'matches', value: 'src/**' }),
          ],
          actions: [makeAction()],
        });
        const { container, onchange } = renderConditionsOnlyBuilder([rule]);
        const ruleNameInput = container.querySelector<HTMLInputElement>(
          '[aria-label="Rule name for PR Review Rule"]',
        )!;

        await fireEvent.input(ruleNameInput, { target: { value: 'Renamed Rule' } });
        await fireEvent.blur(ruleNameInput);

        expect(onchange).toHaveBeenCalledTimes(1);
        const [nextRules] = onchange.mock.calls[0]!;
        expect(nextRules[0].conditions[0].value).toBe('false');
        expect(nextRules[0].conditions[0].operator).toBe('eq');
        expect(nextRules[0].actions).toEqual([]);
      });

      test('coerces an enum value outside the field choices when the rule is edited via an unrelated change', async () => {
        const rule = makeRule({
          conditions: [
            makeCondition({ id: 'c1', field: 'severity', operator: 'is', value: 'nonexistent' }),
          ],
        });
        const { container, onchange } = renderConditionsOnlyBuilder([rule]);
        const ruleNameInput = container.querySelector<HTMLInputElement>(
          '[aria-label="Rule name for PR Review Rule"]',
        )!;

        await fireEvent.input(ruleNameInput, { target: { value: 'Renamed Rule' } });
        await fireEvent.blur(ruleNameInput);

        const [nextRules] = onchange.mock.calls[0]!;
        expect(nextRules[0].conditions[0].value).toBe('low');
      });

      test('leaves an already-valid condition value untouched on an unrelated edit', async () => {
        const rule = makeRule({
          conditions: [
            makeCondition({ id: 'c1', field: 'enabled', operator: 'eq', value: 'true' }),
          ],
        });
        const { container, onchange } = renderConditionsOnlyBuilder([rule]);
        const ruleNameInput = container.querySelector<HTMLInputElement>(
          '[aria-label="Rule name for PR Review Rule"]',
        )!;

        await fireEvent.input(ruleNameInput, { target: { value: 'Renamed Rule' } });
        await fireEvent.blur(ruleNameInput);

        const [nextRules] = onchange.mock.calls[0]!;
        expect(nextRules[0].conditions[0].value).toBe('true');
      });

      test('full mode never coerces condition values (conditions-only-only behavior)', async () => {
        const rule = makeRule({
          conditions: [makeCondition({ field: 'path', operator: 'matches', value: 'not-a-bool' })],
        });
        const { container, onchange } = renderBuilder([rule]);
        const ruleNameInput = container.querySelector<HTMLInputElement>(
          '[aria-label="Rule name for PR Review Rule"]',
        )!;

        await fireEvent.input(ruleNameInput, { target: { value: 'Renamed Rule' } });
        await fireEvent.blur(ruleNameInput);

        const [nextRules] = onchange.mock.calls[0]!;
        expect(nextRules[0].conditions[0].value).toBe('not-a-bool');
      });

      test.each(['e', '+e', 'e+', 'e5'])(
        'coerces an exponent-only fragment (%s) with no mantissa to empty on an unrelated edit',
        async (staleValue) => {
          const rule = makeRule({
            conditions: [
              makeCondition({ id: 'c1', field: 'retries', operator: 'is', value: staleValue }),
            ],
          });
          const { container, onchange } = renderConditionsOnlyBuilder([rule]);
          const ruleNameInput = container.querySelector<HTMLInputElement>(
            '[aria-label="Rule name for PR Review Rule"]',
          )!;

          await fireEvent.input(ruleNameInput, { target: { value: 'Renamed Rule' } });
          await fireEvent.blur(ruleNameInput);

          const [nextRules] = onchange.mock.calls[0]!;
          expect(nextRules[0].conditions[0].value).toBe('');
        },
      );

      test.each(['0x10', '5px'])(
        'coerces a non-canonical numeric value (%s) to empty on an unrelated edit — matches what the number input would blank',
        async (staleValue) => {
          const rule = makeRule({
            conditions: [
              makeCondition({ id: 'c1', field: 'retries', operator: 'is', value: staleValue }),
            ],
          });
          const { container, onchange } = renderConditionsOnlyBuilder([rule]);
          const ruleNameInput = container.querySelector<HTMLInputElement>(
            '[aria-label="Rule name for PR Review Rule"]',
          )!;

          await fireEvent.input(ruleNameInput, { target: { value: 'Renamed Rule' } });
          await fireEvent.blur(ruleNameInput);

          const [nextRules] = onchange.mock.calls[0]!;
          expect(nextRules[0].conditions[0].value).toBe('');
        },
      );

      test.each(['   ', '\t', '\n '])(
        'coerces a whitespace-only numeric value (%j) to empty on an unrelated edit — a blank number is not a valid number',
        async (whitespaceValue) => {
          const rule = makeRule({
            conditions: [
              makeCondition({
                id: 'c1',
                field: 'retries',
                operator: 'is',
                value: whitespaceValue,
              }),
            ],
          });
          const { container, onchange } = renderConditionsOnlyBuilder([rule]);
          const ruleNameInput = container.querySelector<HTMLInputElement>(
            '[aria-label="Rule name for PR Review Rule"]',
          )!;

          await fireEvent.input(ruleNameInput, { target: { value: 'Renamed Rule' } });
          await fireEvent.blur(ruleNameInput);

          const [nextRules] = onchange.mock.calls[0]!;
          expect(nextRules[0].conditions[0].value).toBe('');
        },
      );

      test('leaves a canonical numeric value untouched on an unrelated edit', async () => {
        const rule = makeRule({
          conditions: [makeCondition({ id: 'c1', field: 'retries', operator: 'is', value: '42' })],
        });
        const { container, onchange } = renderConditionsOnlyBuilder([rule]);
        const ruleNameInput = container.querySelector<HTMLInputElement>(
          '[aria-label="Rule name for PR Review Rule"]',
        )!;

        await fireEvent.input(ruleNameInput, { target: { value: 'Renamed Rule' } });
        await fireEvent.blur(ruleNameInput);

        const [nextRules] = onchange.mock.calls[0]!;
        expect(nextRules[0].conditions[0].value).toBe('42');
      });

      test.each(['-', '1.', '1e', '1e5', '-2.5'])(
        'treats the in-progress numeric typing state (%s) as valid — not coerced — on an unrelated edit',
        async (typedValue) => {
          const rule = makeRule({
            conditions: [
              makeCondition({ id: 'c1', field: 'retries', operator: 'is', value: typedValue }),
            ],
          });
          const { container, onchange } = renderConditionsOnlyBuilder([rule]);
          const ruleNameInput = container.querySelector<HTMLInputElement>(
            '[aria-label="Rule name for PR Review Rule"]',
          )!;

          await fireEvent.input(ruleNameInput, { target: { value: 'Renamed Rule' } });
          await fireEvent.blur(ruleNameInput);

          const [nextRules] = onchange.mock.calls[0]!;
          expect(nextRules[0].conditions[0].value).toBe(typedValue);
        },
      );

      test('live typing "1." into the number value input is not blanked by emitChange', async () => {
        const rule = makeRule({
          conditions: [makeCondition({ id: 'c1', field: 'retries', operator: 'is', value: '1' })],
        });
        const { container, onchange } = renderConditionsOnlyBuilder([rule]);
        const valueInput = container.querySelector<HTMLInputElement>(
          '[aria-label="Value for condition 1 of PR Review Rule"]',
        )!;

        await fireEvent.input(valueInput, { target: { value: '1.' } });

        expect(onchange).toHaveBeenCalledTimes(1);
        const [nextRules] = onchange.mock.calls[0]!;
        expect(nextRules[0].conditions[0].value).toBe('1.');
      });
    });
  });

  describe('flat-conditions mode', () => {
    test('accepts direct conditions and makes grouped rule state a type error', () => {
      const validProps = {
        mode: 'flat-conditions',
        conditions: [makeCondition({ operator: 'eq' })],
        fieldOptions: typedFieldOptions,
        onchange: () => {},
      } satisfies InvocationRuleBuilderProps;

      expect(validProps.conditions).toHaveLength(1);

      const invalidProps = {
        mode: 'flat-conditions',
        conditions: [],
        rules: [makeRule()],
        fieldOptions: typedFieldOptions,
        onchange: () => {},
      } as const;
      // @ts-expect-error flat-conditions mode cannot accept rule groups
      const _invalidContract: InvocationRuleBuilderProps = invalidProps;
      expect(invalidProps.rules).toHaveLength(1);
    });

    test('renders condition controls without add, rename, move, or remove rule controls', () => {
      const { container } = renderFlatConditionsBuilder([
        makeCondition({ field: 'label', operator: 'eq', value: 'security' }),
      ]);

      expect(container.querySelector('[data-irb-add-rule]')).toBeNull();
      expect(container.querySelector('[data-irb-rule-remove]')).toBeNull();
      expect(container.querySelector('.cinder-invocation-rule-builder__rule-header')).toBeNull();
      expect(
        container.querySelector('.cinder-invocation-rule-builder__rule-label-input'),
      ).toBeNull();
      expect(container.querySelector('[data-irb-add-condition]')).not.toBeNull();
      expect(container.querySelector('[data-irb-condition-remove]')).not.toBeNull();
    });

    test('emits the direct conditions array and a change without rule metadata', async () => {
      const { container, onchange } = renderFlatConditionsBuilder([
        makeCondition({ field: 'label', operator: 'eq', value: 'security' }),
      ]);
      const valueInput = container.querySelector<HTMLInputElement>(
        '[aria-label="Value for condition 1 of Conditions"]',
      )!;

      await fireEvent.input(valueInput, { target: { value: 'backend' } });

      expect(onchange).toHaveBeenCalledTimes(1);
      const [nextConditions, change] = onchange.mock.calls[0]!;
      expect(nextConditions).toEqual([
        makeCondition({ field: 'label', operator: 'eq', value: 'backend' }),
      ]);
      expect(change).toEqual({
        type: 'update-condition',
        conditionId: 'c1',
        field: 'value',
      });
      expect(change).not.toHaveProperty('ruleId');
    });

    test('adds and removes conditions through the direct flat contract', async () => {
      const initialCondition = makeCondition({ field: 'label', operator: 'eq' });
      const added = renderFlatConditionsBuilder([]);

      await fireEvent.click(
        added.container.querySelector<HTMLElement>('[data-irb-add-condition]')!,
      );

      const [addedConditions, addChange] = added.onchange.mock.calls[0]!;
      expect(addedConditions).toHaveLength(1);
      expect(addChange).toEqual({
        type: 'add-condition',
        conditionId: addedConditions[0].id,
      });

      cleanup();
      const removed = renderFlatConditionsBuilder([initialCondition]);
      await fireEvent.click(
        removed.container.querySelector<HTMLElement>('[data-irb-condition-remove]')!,
      );

      expect(removed.onchange.mock.calls[0]?.[0]).toEqual([]);
      expect(removed.onchange.mock.calls[0]?.[1]).toEqual({
        type: 'remove-condition',
        conditionId: 'c1',
      });
    });
  });

  describe('CSS snapshot', () => {
    test('CSS file exists and is non-empty', async () => {
      const { readFileSync } = await import('node:fs');
      const css = readFileSync(new URL('./invocation-rule-builder.css', import.meta.url), 'utf8');
      expect(css).toContain('cinder-invocation-rule-builder');
      expect(css).toContain('@layer cinder.components');
    });
  });
});
