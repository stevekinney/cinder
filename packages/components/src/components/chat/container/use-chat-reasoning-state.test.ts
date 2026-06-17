/**
 * Tests for use-chat-reasoning-state.svelte.ts (C4).
 *
 * Covers:
 *   1. All reasoning blocks are collapsed by default.
 *   2. toggle() expands a collapsed reasoning block.
 *   3. toggle() collapses an expanded reasoning block.
 *   4. Expanding one block does not expand others.
 *   5. onRemeasureRow callback fires on toggle (with the toggled message id).
 *   6. onRemeasureRow fires both on expand and collapse.
 *   7. Works safely when no onRemeasureRow is provided.
 */

/// <reference lib="dom" />
import { describe, expect, mock, test } from 'bun:test';

import { setupHappyDom } from '../../../test/happy-dom.ts';

setupHappyDom();

// The module uses runes ($state) — it MUST be imported in the test harness so
// the rune transform runs. The `setupHappyDom` call above ensures the happy-dom
// environment is active before import.
const { useChatReasoningState } = await import('./use-chat-reasoning-state.svelte.ts');

describe('useChatReasoningState — initial state', () => {
  test('all message ids start collapsed', () => {
    const state = useChatReasoningState({});
    expect(state.isExpanded('msg-1')).toBe(false);
    expect(state.isExpanded('msg-2')).toBe(false);
  });
});

describe('useChatReasoningState — toggle', () => {
  test('toggle() expands a collapsed reasoning block', () => {
    const state = useChatReasoningState({});
    state.toggle('msg-1');
    expect(state.isExpanded('msg-1')).toBe(true);
  });

  test('toggle() collapses an expanded reasoning block', () => {
    const state = useChatReasoningState({});
    state.toggle('msg-1');
    state.toggle('msg-1');
    expect(state.isExpanded('msg-1')).toBe(false);
  });

  test('expanding one block does not expand another', () => {
    const state = useChatReasoningState({});
    state.toggle('msg-1');
    expect(state.isExpanded('msg-1')).toBe(true);
    expect(state.isExpanded('msg-2')).toBe(false);
  });

  test('multiple independent blocks can be expanded simultaneously', () => {
    const state = useChatReasoningState({});
    state.toggle('msg-1');
    state.toggle('msg-2');
    expect(state.isExpanded('msg-1')).toBe(true);
    expect(state.isExpanded('msg-2')).toBe(true);
  });
});

describe('useChatReasoningState — reset', () => {
  test('reset() collapses all expanded reasoning blocks', () => {
    const state = useChatReasoningState({});
    state.toggle('msg-1');
    state.toggle('msg-2');
    expect(state.isExpanded('msg-1')).toBe(true);
    expect(state.isExpanded('msg-2')).toBe(true);

    state.reset();

    expect(state.isExpanded('msg-1')).toBe(false);
    expect(state.isExpanded('msg-2')).toBe(false);
  });

  test('toggle works normally after reset', () => {
    const state = useChatReasoningState({});
    state.toggle('msg-1');
    state.reset();
    state.toggle('msg-1');
    expect(state.isExpanded('msg-1')).toBe(true);
  });
});

describe('useChatReasoningState — remeasure callback', () => {
  test('onRemeasureRow is called with the message id on expand', () => {
    const onRemeasureRow = mock((id: string) => id);
    const state = useChatReasoningState({ onRemeasureRow });
    state.toggle('msg-a');
    expect(onRemeasureRow).toHaveBeenCalledTimes(1);
    expect(onRemeasureRow).toHaveBeenCalledWith('msg-a');
  });

  test('onRemeasureRow is called with the message id on collapse', () => {
    const onRemeasureRow = mock((id: string) => id);
    const state = useChatReasoningState({ onRemeasureRow });
    state.toggle('msg-a'); // expand
    state.toggle('msg-a'); // collapse
    expect(onRemeasureRow).toHaveBeenCalledTimes(2);
    expect(onRemeasureRow).toHaveBeenNthCalledWith(1, 'msg-a');
    expect(onRemeasureRow).toHaveBeenNthCalledWith(2, 'msg-a');
  });

  test('no error when onRemeasureRow is not provided', () => {
    const state = useChatReasoningState({});
    // Should not throw
    expect(() => state.toggle('msg-b')).not.toThrow();
  });
});
