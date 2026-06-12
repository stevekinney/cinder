/// <reference lib="dom" />
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';
import type {
  InvocationRule,
  InvocationRuleAction,
  InvocationRuleCondition,
  InvocationRuleOption,
} from './invocation-rule-builder.types.ts';

setupHappyDom();

const { cleanup, fireEvent, render } = await import('@testing-library/svelte');
const { default: InvocationRuleBuilder } = await import('./invocation-rule-builder.svelte');

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

beforeEach(() => document.body.replaceChildren());
afterEach(() => cleanup());

describe('InvocationRuleBuilder', () => {
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
      expect(container.textContent).toContain('PR Review Rule');
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

  describe('CSS snapshot', () => {
    test('CSS file exists and is non-empty', async () => {
      const { readFileSync } = await import('node:fs');
      const css = readFileSync(new URL('./invocation-rule-builder.css', import.meta.url), 'utf8');
      expect(css).toContain('cinder-invocation-rule-builder');
      expect(css).toContain('@layer cinder.components');
    });
  });
});
