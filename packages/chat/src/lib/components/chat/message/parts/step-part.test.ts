/**
 * Tests for step-part.svelte (C4).
 *
 * Covers:
 *   1. Renders a list item.
 *   2. Title is shown.
 *   3. Content is shown when non-empty.
 *   4. Content is absent when empty.
 *   5. Status icons are present (aria-hidden).
 *   6. Status text suffix is present in a visually-hidden span.
 *   7. aria-current="step" is set on running status.
 *   8. aria-current is absent for non-running statuses.
 *   9. data-cinder-step-status attribute matches the status.
 *  10. PROVE absent by default: a plain message without steps produces no step parts.
 *  11. deriveMessageParts with steps emits step parts in order before markdown.
 *  12. Empty steps array produces no step parts.
 *  13. toRenderUnits groups consecutive step parts into a single 'steps' unit.
 */

/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../../../test/happy-dom.ts';
import type { StepMessagePart, StepStatus } from '../../utilities/types.ts';

setupHappyDom();

const { render, cleanup } = await import('@testing-library/svelte');
const { default: StepPart } = await import('./step-part.svelte');

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

function makeStep(
  status: StepStatus = 'done',
  overrides?: Partial<StepMessagePart>,
): StepMessagePart {
  return {
    type: 'step',
    key: 'm1:step:0',
    index: 0,
    title: 'Load data from API',
    content: 'Fetching user records.',
    status,
    ...overrides,
  };
}

describe('StepPart — basic rendering', () => {
  test('renders a list item', () => {
    const { container } = render(StepPart, { props: { part: makeStep() } });
    expect(container.querySelector('li')).not.toBeNull();
  });

  test('renders the step title', () => {
    const { container } = render(StepPart, { props: { part: makeStep() } });
    expect(container.textContent).toContain('Load data from API');
  });

  test('renders step content when non-empty', () => {
    const { container } = render(StepPart, { props: { part: makeStep() } });
    expect(container.textContent).toContain('Fetching user records.');
  });

  test('does not render content span when content is empty', () => {
    const { container } = render(StepPart, {
      props: { part: makeStep('done', { content: '' }) },
    });
    const contentEl = container.querySelector('.chat-step-content');
    expect(contentEl).toBeNull();
  });
});

describe('StepPart — status semantics', () => {
  const statuses: StepStatus[] = ['pending', 'running', 'done', 'error'];

  for (const status of statuses) {
    test(`data-cinder-step-status="${status}" is set correctly`, () => {
      const { container } = render(StepPart, { props: { part: makeStep(status) } });
      const li = container.querySelector('li');
      expect(li?.getAttribute('data-cinder-step-status')).toBe(status);
    });
  }

  test('aria-current="step" is set for running status', () => {
    const { container } = render(StepPart, { props: { part: makeStep('running') } });
    const li = container.querySelector('li');
    expect(li?.getAttribute('aria-current')).toBe('step');
  });

  test('aria-current is absent for pending status', () => {
    const { container } = render(StepPart, { props: { part: makeStep('pending') } });
    const li = container.querySelector('li');
    expect(li?.hasAttribute('aria-current')).toBe(false);
  });

  test('aria-current is absent for done status', () => {
    const { container } = render(StepPart, { props: { part: makeStep('done') } });
    const li = container.querySelector('li');
    expect(li?.hasAttribute('aria-current')).toBe(false);
  });

  test('aria-current is absent for error status', () => {
    const { container } = render(StepPart, { props: { part: makeStep('error') } });
    const li = container.querySelector('li');
    expect(li?.hasAttribute('aria-current')).toBe(false);
  });
});

describe('StepPart — accessibility (not icon-only)', () => {
  test('indicator icon is aria-hidden', () => {
    const { container } = render(StepPart, { props: { part: makeStep() } });
    const indicator = container.querySelector('.chat-step-indicator');
    expect(indicator?.getAttribute('aria-hidden')).toBe('true');
  });

  test('status suffix is present in visually-hidden span', () => {
    const { container } = render(StepPart, { props: { part: makeStep('running') } });
    const srOnly = container.querySelector('.sr-only');
    expect(srOnly).not.toBeNull();
    // The visually-hidden suffix communicates status as text
    expect(srOnly?.textContent).toContain('in progress');
  });

  test('done status has "complete" visually-hidden text', () => {
    const { container } = render(StepPart, { props: { part: makeStep('done') } });
    const srOnly = container.querySelector('.sr-only');
    expect(srOnly?.textContent).toContain('complete');
  });

  test('error status has "failed" visually-hidden text', () => {
    const { container } = render(StepPart, { props: { part: makeStep('error') } });
    const srOnly = container.querySelector('.sr-only');
    expect(srOnly?.textContent).toContain('failed');
  });

  test('pending status has "pending" visually-hidden text', () => {
    const { container } = render(StepPart, { props: { part: makeStep('pending') } });
    const srOnly = container.querySelector('.sr-only');
    expect(srOnly?.textContent).toContain('pending');
  });
});

describe('StepPart — derive integration', () => {
  test('plain message without steps produces no step parts', async () => {
    const { deriveMessageParts } = await import('../../utilities/utilities.ts');
    const message = {
      id: 'msg-plain',
      role: 'assistant' as const,
      content: 'Hello, world!',
      position: 0,
      metadata: {},
      hidden: false,
      createdAt: new Date().toISOString(),
    };
    const parts = deriveMessageParts(message, {});
    const hasStep = parts.some((p) => p.type === 'step');
    expect(hasStep).toBe(false);
  });

  test('empty steps array produces no step parts', async () => {
    const { deriveMessageParts } = await import('../../utilities/utilities.ts');
    const message = {
      id: 'msg-empty-steps',
      role: 'assistant' as const,
      content: 'Answer.',
      position: 0,
      metadata: {},
      hidden: false,
      createdAt: new Date().toISOString(),
    };
    const parts = deriveMessageParts(message, { steps: [] });
    const hasStep = parts.some((p) => p.type === 'step');
    expect(hasStep).toBe(false);
  });

  test('steps are emitted in order before reasoning and markdown', async () => {
    const { deriveMessageParts } = await import('../../utilities/utilities.ts');
    const message = {
      id: 'msg-with-steps',
      role: 'assistant' as const,
      content: 'Final answer.',
      position: 0,
      metadata: {},
      hidden: false,
      createdAt: new Date().toISOString(),
    };
    const parts = deriveMessageParts(message, {
      steps: [
        { title: 'Step A', content: '', status: 'done' },
        { title: 'Step B', content: '', status: 'running' },
      ],
      reasoning: 'I reasoned about it.',
    });

    const stepIndexes = parts
      .map((p, i) => ({ type: p.type, i }))
      .filter((x) => x.type === 'step')
      .map((x) => x.i);
    const reasoningIndex = parts.findIndex((p) => p.type === 'reasoning');
    const markdownIndex = parts.findIndex((p) => p.type === 'markdown');

    expect(stepIndexes).toHaveLength(2);
    // All step parts come before reasoning
    for (const stepIndex of stepIndexes) {
      expect(stepIndex).toBeLessThan(reasoningIndex);
    }
    expect(reasoningIndex).toBeLessThan(markdownIndex);
  });

  test('step parts carry correct index, title, content, and status', async () => {
    const { deriveMessageParts } = await import('../../utilities/utilities.ts');
    const message = {
      id: 'msg-step-fields',
      role: 'assistant' as const,
      content: 'Answer.',
      position: 0,
      metadata: {},
      hidden: false,
      createdAt: new Date().toISOString(),
    };
    const parts = deriveMessageParts(message, {
      steps: [
        { title: 'Alpha', content: 'doing alpha', status: 'done' },
        { title: 'Beta', content: 'doing beta', status: 'running' },
      ],
    });

    const stepParts = parts.filter((p) => p.type === 'step');
    expect(stepParts).toHaveLength(2);

    const [alpha, beta] = stepParts;
    expect(alpha).toMatchObject({
      type: 'step',
      index: 0,
      title: 'Alpha',
      content: 'doing alpha',
      status: 'done',
    });
    expect(beta).toMatchObject({
      type: 'step',
      index: 1,
      title: 'Beta',
      content: 'doing beta',
      status: 'running',
    });
  });

  test('toRenderUnits groups consecutive step parts into a single steps unit', async () => {
    const { toRenderUnits } = await import('../chat-message-parts.ts');
    const steps: StepMessagePart[] = [
      {
        type: 'step',
        key: 'm1:step:0',
        index: 0,
        title: 'A',
        content: '',
        status: 'done',
      },
      {
        type: 'step',
        key: 'm1:step:1',
        index: 1,
        title: 'B',
        content: '',
        status: 'running',
      },
    ];
    const units = toRenderUnits(steps);
    expect(units).toHaveLength(1);
    expect(units[0]).toMatchObject({ kind: 'steps', steps });
  });

  test('toRenderUnits does NOT group step parts separated by a non-step part', async () => {
    const { toRenderUnits } = await import('../chat-message-parts.ts');
    const stepA: StepMessagePart = {
      type: 'step',
      key: 'm1:step:0',
      index: 0,
      title: 'A',
      content: '',
      status: 'done',
    };
    const markdown = {
      type: 'markdown' as const,
      key: 'm1:body',
      content: 'between',
      streaming: false,
      expanded: true,
    };
    const stepB: StepMessagePart = {
      type: 'step',
      key: 'm1:step:1',
      index: 1,
      title: 'B',
      content: '',
      status: 'running',
    };
    const units = toRenderUnits([stepA, markdown, stepB]);
    expect(units.map((u) => u.kind)).toEqual(['steps', 'part', 'steps']);
  });
});
