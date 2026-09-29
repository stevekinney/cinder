/**
 * Regression guards for how `ChatMessage` renders tool-call messages through
 * the parts spine. The contract that matters: a tool-call message renders a
 * `ToolCallTimeline` card when a resolved pair is supplied (mirroring the
 * original `isToolCall && toolPair` guard). A standalone `<ChatMessage>` given
 * an empty `toolCallPairs` must fall through to the plain text body — NOT a
 * pending card — exactly as before the parts refactor.
 */

/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRawSnippet, tick } from 'svelte';

import { setupHappyDom } from '@lostgradient/testing';
import { injectStyles } from '../../../test/css.ts';
import type { Message, ToolCallPair } from '../conversation-model.ts';
import type { ToolCallPresentation } from '../utilities/types.ts';

setupHappyDom();

const { render, cleanup, fireEvent } = await import('@testing-library/svelte');
const { default: ChatMessage } = await import('./chat-message.svelte');
const { default: ToolCallTimeline } = await import('./tool-call-timeline.svelte');

const cinderSrOnlyCss = await Bun.file(
  new URL('../../../../../../cinder/src/styles/utilities.css', import.meta.url),
).text();

function toolCallMessage(): Message {
  return {
    id: 'tc-1',
    role: 'tool-call',
    content: 'raw tool-call text body',
    position: 0,
    createdAt: '2026-06-02T00:00:00.000Z',
    metadata: {},
    hidden: false,
    toolCall: { id: 'call-1', name: 'lookup', arguments: {} },
  };
}

function userMessage(overrides?: Partial<Message>): Message {
  return {
    id: 'user-1',
    role: 'user',
    content: 'Please regenerate this answer.',
    position: 0,
    createdAt: '2026-06-02T12:34:00.000Z',
    metadata: {},
    hidden: false,
    ...overrides,
  };
}

function buttonByText(container: HTMLElement, text: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
    (candidate) => candidate.textContent?.includes(text),
  );
  expect(button).toBeDefined();
  return button!;
}

async function clickAndFlush(element: HTMLElement): Promise<void> {
  await fireEvent.click(element);
  await tick();
}

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

describe('ChatMessage — tool-call rendering', () => {
  test('threads owning stream activity through message tool rendering', () => {
    const messageSource = readFileSync(join(import.meta.dir, 'chat-message.svelte'), 'utf8');
    const rendererSource = readFileSync(
      join(import.meta.dir, 'chat-message-parts-renderer.svelte'),
      'utf8',
    );
    const partSource = readFileSync(join(import.meta.dir, 'parts/tool-call-part.svelte'), 'utf8');

    expect(messageSource).toContain('toolActivityActive?: boolean');
    expect(messageSource).toContain('{toolActivityActive}');
    expect(rendererSource).toContain('activityActive={toolActivityActive}');
    expect(partSource).toContain('{activityActive}');
    expect(partSource).toContain('{onToggle}');
  });

  test('tool activity renders through the retained timeline, not the obsolete group component', () => {
    const source = readFileSync(join(import.meta.dir, 'tool-call-timeline.svelte'), 'utf8');
    expect(source).toContain('<RunStepTimeline {steps} label={callsLabel} />');
    expect(source).not.toContain('tool-call-group');
  });

  test('renders custom message status inside the semantic article while timestamps stay below the bubble', () => {
    const { container } = render(ChatMessage, {
      props: {
        message: userMessage(),
        status: createRawSnippet(() => ({
          render: () =>
            '<span data-testid="custom-status">The assistant could not complete this turn.</span>',
          setup: () => {},
        })),
      },
    });

    const bubble = container.querySelector('article.chat-message');
    const status = container.querySelector('[data-testid="custom-status"]');
    const statusRow = container.querySelector('.chat-message-status');
    const metadata = container.querySelector('.chat-message-metadata');
    const timestamp = metadata?.querySelector('time') ?? null;
    expect(bubble).not.toBeNull();
    expect(status).not.toBeNull();
    expect(statusRow).not.toBeNull();
    expect(metadata).not.toBeNull();
    expect(timestamp).not.toBeNull();
    expect(bubble!.contains(status)).toBe(true);
    expect(statusRow!.contains(status)).toBe(true);
    expect(metadata!.contains(timestamp)).toBe(true);
    expect(statusRow!.contains(timestamp)).toBe(false);
  });

  test('renders metadata snippets below the visual message bubble', () => {
    const { container } = render(ChatMessage, {
      props: {
        message: userMessage({ createdAt: '' }),
        metadata: createRawSnippet(() => ({
          render: () => '<span data-testid="read-receipt">Read</span>',
          setup: () => {},
        })),
      },
    });

    const bubble = container.querySelector('article.chat-message');
    const metadata = container.querySelector('.chat-message-metadata');
    const receipt = container.querySelector('[data-testid="read-receipt"]');
    expect(bubble).not.toBeNull();
    expect(metadata).not.toBeNull();
    expect(receipt).not.toBeNull();
    expect(metadata!.contains(receipt)).toBe(true);
    expect(bubble!.contains(receipt)).toBe(false);
  });

  test('compact edit save button exposes resend semantics to assistive technology', async () => {
    const { container } = render(ChatMessage, {
      props: {
        message: userMessage(),
        onEdit: () => {},
      },
    });

    await fireEvent.click(container.querySelector<HTMLButtonElement>('.chat-message-edit-button')!);
    const save = container.querySelector<HTMLButtonElement>('.chat-message-edit-save');
    expect(save).not.toBeNull();
    expect(save?.textContent?.trim()).toBe('Save');
    expect(save?.getAttribute('aria-label')).toBe('Save & Resend');
  });

  test('renders the ToolCallTimeline card when a resolved pair is supplied', () => {
    const message = toolCallMessage();
    const { container } = render(ChatMessage, {
      props: {
        message,
        toolCallPairs: [{ call: message.toolCall! }],
      },
    });
    expect(container.querySelector('.chat-tool-call-timeline')).not.toBeNull();
    expect(container.querySelector('.cinder-run-step-timeline__label')?.textContent).toBe('lookup');
    expect(
      container.querySelector('[aria-live="polite"][aria-atomic="true"]')?.textContent,
    ).toContain('lookup: Pending');
    expect(container.querySelector('.cinder-run-step-timeline__status')?.textContent).toContain(
      'Pending',
    );
  });

  test('announces standalone tool status transitions', async () => {
    const message = toolCallMessage();
    const rendered = render(ChatMessage, {
      props: {
        message,
        toolCallPairs: [{ call: message.toolCall! }],
      },
    });
    const liveRegion = rendered.container.querySelector('[aria-live="polite"][aria-atomic="true"]');
    expect(liveRegion?.textContent).toContain('lookup: Pending');

    await rendered.rerender({
      message,
      toolCallPairs: [
        {
          call: message.toolCall!,
          result: { callId: 'call-1', outcome: 'success', content: 'found' },
        },
      ],
    });
    await tick();

    expect(liveRegion?.textContent).toContain('lookup: Complete');
  });

  test('presentation metadata changes the label and active icon without changing renderer', () => {
    const pair: ToolCallPair = { call: { id: 'search-1', name: 'search_web', arguments: {} } };
    const describeToolCall = (): ToolCallPresentation => ({
      verb: 'Searching',
      tense: 'present',
      detail: 'records',
      kind: 'search',
    });
    const active = render(ToolCallTimeline, {
      props: { pairs: [pair], describeToolCall, activityActive: true },
    });
    expect(active.container.querySelector('.chat-tool-call-timeline')).not.toBeNull();
    expect(active.container.querySelector('.cinder-run-step-timeline__label')?.textContent).toBe(
      'Searching records',
    );
    expect(active.container.querySelector('[data-cinder-tool-activity-active]')).not.toBeNull();
    cleanup();

    const inactive = render(ToolCallTimeline, {
      props: { pairs: [pair], describeToolCall, activityActive: false },
    });
    expect(inactive.container.querySelector('[data-cinder-tool-activity-active]')).toBeNull();
  });

  test('result payloads keep ordinary strings as text and structured JSON as code', async () => {
    const textResult = render(ToolCallTimeline, {
      props: {
        pairs: [
          {
            call: { id: 'string-result', name: 'read_file', arguments: {} },
            result: { callId: 'string-result', outcome: 'success', content: 'plain file contents' },
          },
        ],
      },
    });
    await clickAndFlush(buttonByText(textResult.container, 'Result'));
    expect(
      textResult.container.querySelector('.cinder-run-step-timeline__detail-content'),
    ).not.toBeNull();
    expect(textResult.container.querySelector('.cinder-code-block')).toBeNull();
    expect(textResult.container.textContent).toContain('plain file contents');
    cleanup();

    const jsonResult = render(ToolCallTimeline, {
      props: {
        pairs: [
          {
            call: { id: 'json-result', name: 'lookup', arguments: {} },
            result: { callId: 'json-result', outcome: 'success', content: { ok: true } },
          },
        ],
      },
    });
    await clickAndFlush(buttonByText(jsonResult.container, 'Result'));
    expect(jsonResult.container.querySelector('.cinder-code-block')).not.toBeNull();
    expect(jsonResult.container.querySelector('.cinder-code-block__language')).toBeNull();
    expect(jsonResult.container.textContent).toContain('"ok"');
  });

  test('grouped repeated call ids remain unique and preserve structured error details', async () => {
    const { container } = render(ToolCallTimeline, {
      props: {
        messageId: 'grouped-tools',
        describeToolCall: (pair: ToolCallPair) => ({
          verb: 'Checking',
          tense: 'present',
          detail: pair.call.name,
          kind: 'search',
        }),
        pairs: [
          { call: { id: 'repeated', name: 'first', arguments: {} } },
          {
            call: { id: 'repeated', name: 'second', arguments: {} },
            result: {
              callId: 'repeated',
              outcome: 'error',
              content: null,
              error: {
                code: 'offline',
                category: 'internal',
                retryable: true,
                message: 'Network unavailable',
              },
            },
          },
        ],
      },
    });

    expect(container.querySelectorAll('.cinder-run-step-timeline__item')).toHaveLength(2);
    const disclosureButtons = Array.from(container.querySelectorAll<HTMLButtonElement>('button'));
    expect(disclosureButtons.map((button) => button.textContent?.trim())).toEqual([
      'Arguments',
      'Arguments',
      'Error',
    ]);
    for (const button of disclosureButtons) await clickAndFlush(button);
    const controls = disclosureButtons.map((button) => button.getAttribute('aria-controls'));
    expect(new Set(controls).size).toBe(disclosureButtons.length);
    expect(controls.every((id) => id?.includes('grouped-tools'))).toBe(true);
    const heading = container.querySelector('h3');
    expect(container.querySelector('section')?.getAttribute('aria-labelledby')).toBe(heading?.id);
    expect(heading?.textContent).toContain('Called 2 tools');
    expect(container.textContent).toContain('Network unavailable');
  });

  describe('counted strings agree with the count', () => {
    const pair: ToolCallPair = { call: { id: 'only', name: 'lookup', arguments: {} } };
    const second: ToolCallPair = { call: { id: 'other', name: 'fetch', arguments: {} } };
    const describeToolCall = (): ToolCallPresentation => ({
      verb: 'Checking',
      tense: 'present',
      detail: 'records',
      kind: 'search',
    });

    test('says "1 tool" for one pair and "2 tools" for two', () => {
      const one = render(ToolCallTimeline, {
        props: { pairs: [pair], messageId: 'count-one', describeToolCall },
      });
      expect(one.container.querySelector('h3')?.textContent).toContain('Called 1 tool');
      expect(one.container.querySelector('h3')?.textContent).not.toContain('1 tools');
      cleanup();

      const two = render(ToolCallTimeline, {
        props: { pairs: [pair, second], messageId: 'count-two', describeToolCall },
      });
      expect(two.container.querySelector('h3')?.textContent).toContain('Called 2 tools');
    });

    test('names the list "1 consecutive tool call" for one pair', () => {
      const one = render(ToolCallTimeline, {
        props: { pairs: [pair], messageId: 'label-one', describeToolCall },
      });
      const list = one.container.querySelector('ol.cinder-run-step-timeline');
      expect(list?.getAttribute('aria-label')).toBe('1 consecutive tool call');
      cleanup();

      const two = render(ToolCallTimeline, {
        props: { pairs: [pair, second], messageId: 'label-two', describeToolCall },
      });
      expect(
        two.container.querySelector('ol.cinder-run-step-timeline')?.getAttribute('aria-label'),
      ).toBe('2 consecutive tool calls');
    });
  });

  test('namespaces grouped disclosure ids across separate timelines', async () => {
    const pair: ToolCallPair = { call: { id: 'reused', name: 'lookup', arguments: {} } };
    const describeToolCall = (): ToolCallPresentation => ({
      verb: 'Checking',
      tense: 'present',
      detail: 'records',
      kind: 'search',
    });
    const first = render(ToolCallTimeline, {
      props: { pairs: [pair], messageId: 'timeline-one', describeToolCall },
    });
    const second = render(ToolCallTimeline, {
      props: { pairs: [pair], messageId: 'timeline-two', describeToolCall },
    });
    const firstButton = buttonByText(first.container, 'Arguments');
    const secondButton = buttonByText(second.container, 'Arguments');
    await clickAndFlush(firstButton);
    await clickAndFlush(secondButton);
    const firstControls = firstButton.getAttribute('aria-controls');
    const secondControls = secondButton.getAttribute('aria-controls');
    expect(firstControls).toContain('timeline-one-0-reused-arguments-panel');
    expect(secondControls).toContain('timeline-two-0-reused-arguments-panel');
    expect(firstControls).not.toBe(secondControls);
    expect(
      firstControls ? first.container.ownerDocument.getElementById(firstControls) : null,
    ).not.toBeNull();
    expect(
      secondControls ? second.container.ownerDocument.getElementById(secondControls) : null,
    ).not.toBeNull();
  });

  test('grouped action-required results render null payloads explicitly', async () => {
    const { container } = render(ToolCallTimeline, {
      props: {
        pairs: [
          {
            call: { id: 'approval', name: 'request-approval', arguments: {} },
            result: { callId: 'approval', outcome: 'action_required', content: null },
          },
        ],
      },
    });

    await clickAndFlush(buttonByText(container, 'Result'));
    expect(container.textContent).toContain('null');
  });

  test('tool-call card is collapsed by default (payload bodies hidden)', () => {
    const message = toolCallMessage();
    const { container } = render(ChatMessage, {
      props: {
        message,
        toolCallPairs: [
          {
            call: message.toolCall!,
            result: { callId: 'call-1', outcome: 'success', content: { ok: true } },
          },
        ],
      },
    });
    expect(container.querySelector('.chat-tool-call-timeline')).not.toBeNull();
    expect(container.querySelector('.cinder-collapsible__panel')).toBeNull();
    expect(container.textContent).not.toContain('"ok"');
    expect(buttonByText(container, 'Arguments').getAttribute('aria-expanded')).toBe('false');
  });

  test('tool-call timeline IDs include the ChatMessage occurrence prefix', () => {
    const message = toolCallMessage();
    const toolCallPairs: ToolCallPair[] = [
      {
        call: message.toolCall!,
        result: { callId: 'call-1', outcome: 'success', content: { ok: true } },
      },
    ];

    render(ChatMessage, {
      props: {
        message,
        idPrefix: 'sub-session-a-tc-1',
        toolCallPairs,
      },
    });
    render(ChatMessage, {
      props: {
        message,
        idPrefix: 'sub-session-b-tc-1',
        toolCallPairs,
      },
    });
    render(ChatMessage, {
      props: {
        message: { ...message, id: 'foo-message' },
        toolCallPairs,
      },
    });
    render(ChatMessage, {
      props: {
        message: { ...message, id: 'foo-message' },
        idPrefix: 'foo',
        toolCallPairs,
      },
    });

    const timelines = Array.from(
      document.body.querySelectorAll<HTMLElement>('.chat-message .chat-tool-call-timeline'),
    );
    const timelineIds = timelines.map((timeline) => timeline.id);
    const headingIds = timelines.map((timeline) => timeline.getAttribute('aria-labelledby') ?? '');

    expect(timelineIds).toEqual([
      'message-sub-session-a-tc-1-message-tool-call-call-1',
      'message-sub-session-b-tc-1-message-tool-call-call-1',
      'message-message-foo-message-tool-call-call-1',
      'message-foo-message-tool-call-call-1',
    ]);
    expect(new Set(timelineIds).size).toBe(timelineIds.length);
    expect(new Set(headingIds).size).toBe(headingIds.length);
  });

  test('tool-call disclosure is decoupled from markdown truncation (long text stays full)', () => {
    const longText = 'x'.repeat(2000);
    const message: Message = {
      id: 'assistant-1',
      role: 'assistant',
      content: longText,
      position: 0,
      createdAt: '2026-06-02T00:00:00.000Z',
      metadata: {},
      hidden: false,
    };
    const { container } = render(ChatMessage, { props: { message } });
    expect(container.textContent).toContain(longText);
    const control = container.querySelector('.chat-message-expand');
    expect(control?.textContent?.trim()).toBe('Show less');
  });

  test('a standalone ChatMessage (no ontoolcalltoggle) can still expand its tool-call details', async () => {
    const message = toolCallMessage();
    const { container } = render(ChatMessage, {
      props: {
        message,
        toolCallPairs: [{ call: message.toolCall! }],
      },
    });
    const button = buttonByText(container, 'Arguments');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    await clickAndFlush(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelector('.cinder-collapsible__panel')).not.toBeNull();
  });

  test('toggling a tool-call detail fires onExpandedChange, matching the pre-split contract', async () => {
    const message = toolCallMessage();
    const changes: boolean[] = [];
    const { container } = render(ChatMessage, {
      props: {
        message,
        toolCallPairs: [{ call: message.toolCall! }],
        onExpandedChange: (expanded: boolean) => changes.push(expanded),
      },
    });
    await clickAndFlush(buttonByText(container, 'Arguments'));
    expect(changes).toEqual([true]);
  });

  test('status announcer keeps the transferred cinder-sr-only clipping contract', () => {
    const removeStyles = injectStyles(cinderSrOnlyCss);
    try {
      const { container } = render(ToolCallTimeline, {
        props: { pairs: [{ call: { id: 'note-1', name: 'remember_note', arguments: {} } }] },
      });
      const announcer = container.querySelector('[aria-live="polite"]');
      expect(announcer).not.toBeNull();
      expect(announcer?.textContent).toContain('remember_note');
      expect(announcer?.classList.contains('cinder-sr-only')).toBe(true);
      expect(announcer?.classList.contains('sr-only')).toBe(false);

      const computed = getComputedStyle(announcer as Element);
      expect(computed.display).not.toBe('none');
      expect(computed.visibility).not.toBe('hidden');
      expect(computed.position).toBe('absolute');
      expect(computed.width).toBe('1px');
      expect(computed.height).toBe('1px');
      expect(computed.overflow).toBe('hidden');
      expect(computed.clip).toBe('rect(0, 0, 0, 0)');
      expect(computed.whiteSpace).toBe('nowrap');
    } finally {
      removeStyles();
    }
  });

  test('falls through to the text body when no pair is supplied (regression guard)', () => {
    const message = toolCallMessage();
    const { container } = render(ChatMessage, {
      props: { message, toolCallPairs: [] },
    });
    expect(container.querySelector('.chat-tool-call-timeline')).toBeNull();
    expect(container.querySelector('.message-content')).not.toBeNull();
    expect(container.textContent).toContain('raw tool-call text body');
  });
});
