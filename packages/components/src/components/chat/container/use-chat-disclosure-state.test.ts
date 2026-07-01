/**
 * Tests for use-chat-disclosure-state.svelte.ts.
 *
 * Covers:
 *   1. All disclosures are collapsed by default.
 *   2. toggle() expands a collapsed disclosure.
 *   3. toggle() collapses an expanded disclosure.
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
const { useChatDisclosureState } = await import('./use-chat-disclosure-state.svelte.ts');

describe('useChatDisclosureState — initial state', () => {
  test('all message ids start collapsed', () => {
    const state = useChatDisclosureState({});
    expect(state.isExpanded('msg-1')).toBe(false);
    expect(state.isExpanded('msg-2')).toBe(false);
  });
});

describe('useChatDisclosureState — toggle', () => {
  test('toggle() expands a collapsed disclosure', () => {
    const state = useChatDisclosureState({});
    state.toggle('msg-1');
    expect(state.isExpanded('msg-1')).toBe(true);
  });

  test('toggle() collapses an expanded disclosure', () => {
    const state = useChatDisclosureState({});
    state.toggle('msg-1');
    state.toggle('msg-1');
    expect(state.isExpanded('msg-1')).toBe(false);
  });

  test('expanding one block does not expand another', () => {
    const state = useChatDisclosureState({});
    state.toggle('msg-1');
    expect(state.isExpanded('msg-1')).toBe(true);
    expect(state.isExpanded('msg-2')).toBe(false);
  });

  test('multiple independent blocks can be expanded simultaneously', () => {
    const state = useChatDisclosureState({});
    state.toggle('msg-1');
    state.toggle('msg-2');
    expect(state.isExpanded('msg-1')).toBe(true);
    expect(state.isExpanded('msg-2')).toBe(true);
  });
});

describe('useChatDisclosureState — reset', () => {
  test('reset() collapses all expanded disclosures', () => {
    const state = useChatDisclosureState({});
    state.toggle('msg-1');
    state.toggle('msg-2');
    expect(state.isExpanded('msg-1')).toBe(true);
    expect(state.isExpanded('msg-2')).toBe(true);

    state.reset();

    expect(state.isExpanded('msg-1')).toBe(false);
    expect(state.isExpanded('msg-2')).toBe(false);
  });

  test('toggle works normally after reset', () => {
    const state = useChatDisclosureState({});
    state.toggle('msg-1');
    state.reset();
    state.toggle('msg-1');
    expect(state.isExpanded('msg-1')).toBe(true);
  });
});

describe('useChatDisclosureState — remeasure callback', () => {
  test('onRemeasureRow is called with the message id on expand', () => {
    const onRemeasureRow = mock((id: string) => id);
    const state = useChatDisclosureState({ onRemeasureRow });
    state.toggle('msg-a');
    expect(onRemeasureRow).toHaveBeenCalledTimes(1);
    expect(onRemeasureRow).toHaveBeenCalledWith('msg-a');
  });

  test('onRemeasureRow is called with the message id on collapse', () => {
    const onRemeasureRow = mock((id: string) => id);
    const state = useChatDisclosureState({ onRemeasureRow });
    state.toggle('msg-a'); // expand
    state.toggle('msg-a'); // collapse
    expect(onRemeasureRow).toHaveBeenCalledTimes(2);
    expect(onRemeasureRow).toHaveBeenNthCalledWith(1, 'msg-a');
    expect(onRemeasureRow).toHaveBeenNthCalledWith(2, 'msg-a');
  });

  test('no error when onRemeasureRow is not provided', () => {
    const state = useChatDisclosureState({});
    // Should not throw
    expect(() => state.toggle('msg-b')).not.toThrow();
  });
});
