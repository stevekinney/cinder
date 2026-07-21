/* eslint-disable max-lines -- Comprehensive matrix for plugin state and async lifecycle regressions. */
/**
 * Tests for the template completion plugin internal logic.
 *
 * DEP-583: Validates filterAndSortCandidates, mergeCandidates, detectTokenQuery,
 * and computeCompletionState using ProseMirror's model and state layers in Node.
 * Async plugin view lifecycle coverage uses a minimal mocked document instead of
 * a real DOM runtime.
 */

import type {
  PlaceholderCandidate,
  PlaceholderCompletionConfiguration,
} from '@cinder/markdown/templates/types';
import { Schema } from '@milkdown/kit/prose/model';
import type { Plugin, Transaction } from '@milkdown/kit/prose/state';
import { EditorState, TextSelection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';

import {
  computeCompletionState,
  createTemplateCompletionPlugin,
  detectTokenQuery,
  filterAndSortCandidates,
  findTokenEnd,
  INACTIVE_STATE,
  MAXIMUM_VISIBLE_SUGGESTIONS,
  mergeCandidates,
  templateCompletionPluginKey,
} from './template-completion-plugin.js';

// ---------------------------------------------------------------------------
// Test schema
// ---------------------------------------------------------------------------

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: {
      content: 'inline*',
      group: 'block',
      parseDOM: [{ tag: 'p' }],
      toDOM() {
        return ['p', 0];
      },
    },
    text: { group: 'inline' },
  },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCandidate(path: string, description?: string): PlaceholderCandidate {
  return { path, description, valueKind: 'string' as const };
}

function makeCandidates(...paths: string[]): PlaceholderCandidate[] {
  return paths.map((path) => makeCandidate(path));
}

/**
 * Create an EditorState with a single paragraph containing the given text
 * and the cursor positioned at the specified character offset within the
 * paragraph content.
 *
 * When `cursorOffset` is omitted the selection defaults to the end of the
 * document (ProseMirror's default).
 */
function createStateWithText(text: string, cursorOffset?: number): EditorState {
  const doc = schema.node('doc', null, [
    schema.node('paragraph', null, text ? [schema.text(text)] : []),
  ]);
  const state = EditorState.create({ doc, schema });

  if (cursorOffset !== undefined) {
    // Position = 1 (doc open) + cursorOffset (within paragraph content).
    return state.apply(state.tr.setSelection(TextSelection.create(state.doc, 1 + cursorOffset)));
  }

  return state;
}

/**
 * Create an EditorState with a non-collapsed (range) selection.
 */
function createStateWithSelection(text: string, from: number, to: number): EditorState {
  const doc = schema.node('doc', null, [
    schema.node('paragraph', null, text ? [schema.text(text)] : []),
  ]);
  const state = EditorState.create({ doc, schema });

  return state.apply(state.tr.setSelection(TextSelection.create(state.doc, 1 + from, 1 + to)));
}

function createStateWithTextAndPlugins(
  text: string,
  cursorOffset: number,
  plugins: readonly Plugin[],
): EditorState {
  const doc = schema.node('doc', null, [
    schema.node('paragraph', null, text ? [schema.text(text)] : []),
  ]);
  const state = EditorState.create({ doc, schema, plugins: [...plugins] });

  return state.apply(state.tr.setSelection(TextSelection.create(state.doc, 1 + cursorOffset)));
}

type MockElement = {
  className: string;
  style: Record<string, string>;
  textContent: string;
  parentElement: MockElement | null;
  classList: { add: (...tokens: string[]) => void };
  setAttribute: (name: string, value: string) => void;
  appendChild: (child: MockElement) => MockElement;
  removeChild: (child: MockElement) => MockElement;
  addEventListener: () => void;
  getBoundingClientRect: () => DOMRect;
};

function createMockElement(): MockElement {
  const children: MockElement[] = [];
  const attributes = new Map<string, string>();

  const element: MockElement = {
    className: '',
    style: {},
    textContent: '',
    parentElement: null,
    classList: {
      add(...tokens: string[]) {
        if (tokens.length === 0) return;
        const existing = element.className ? element.className.split(/\s+/) : [];
        element.className = [...new Set([...existing, ...tokens])].join(' ');
      },
    },
    setAttribute(name: string, value: string) {
      attributes.set(name, value);
    },
    appendChild(child: MockElement) {
      child.parentElement = element;
      children.push(child);
      return child;
    },
    removeChild(child: MockElement) {
      const index = children.indexOf(child);
      if (index >= 0) {
        children.splice(index, 1);
        child.parentElement = null;
      }
      return child;
    },
    addEventListener() {},
    getBoundingClientRect() {
      return {
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        width: 0,
        height: 0,
        toJSON() {
          return {};
        },
      } as DOMRect;
    },
  };

  return element;
}

type CompletionHarness = {
  view: EditorView;
  pluginView: {
    update?: (view: EditorView, previousState: EditorState) => void;
    destroy?: () => void;
  };
  typeText: (text: string) => void;
  getPluginState: () => ReturnType<typeof templateCompletionPluginKey.getState>;
};

async function createCompletionHarness(
  configuration: PlaceholderCompletionConfiguration,
  text = '{{',
): Promise<CompletionHarness> {
  const completionPlugin = createTemplateCompletionPlugin(() => configuration) as unknown as {
    (ctx: {
      wait: () => Promise<void>;
      update: (slice: unknown, updater: (plugins: Plugin[]) => Plugin[]) => void;
    }): () => Promise<unknown>;
    plugin: () => Plugin;
  };

  const registeredPlugins: Plugin[] = [];
  const initializePlugin = completionPlugin({
    wait: async () => {},
    update: (_slice, updater) => {
      const updated = updater(registeredPlugins);
      registeredPlugins.length = 0;
      registeredPlugins.push(...updated);
    },
  });
  await initializePlugin();

  const prosePlugin = completionPlugin.plugin();
  let state = createStateWithTextAndPlugins(text, text.length, [prosePlugin]);

  let pluginView: CompletionHarness['pluginView'] = {};
  const view = {
    get state() {
      return state;
    },
    set state(nextState: EditorState) {
      state = nextState;
    },
    dom: {
      parentElement: document.body,
    },
    dispatch(transaction: Transaction) {
      const previousState = state;
      state = state.apply(transaction);
      pluginView.update?.(view as unknown as EditorView, previousState);
    },
    coordsAtPos() {
      return { left: 0, right: 0, top: 0, bottom: 0 };
    },
  };

  pluginView = prosePlugin.spec.view?.(view as unknown as EditorView) ?? {};

  return {
    view: view as unknown as EditorView,
    pluginView,
    typeText(inputText: string) {
      for (const character of inputText) {
        const cursorPosition = state.selection.from;
        const transaction = state.tr.insertText(character, cursorPosition, cursorPosition);
        view.dispatch(transaction);
      }
    },
    getPluginState() {
      return templateCompletionPluginKey.getState(state);
    },
  };
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

async function flushTimers(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await flushMicrotasks();
}

// ---------------------------------------------------------------------------
// filterAndSortCandidates
// ---------------------------------------------------------------------------

describe('filterAndSortCandidates', () => {
  const candidates = makeCandidates(
    'input.name',
    'input.age',
    'input.address',
    'output.result',
    'output.error',
    'config.timeout',
    'config.retries',
    'metadata.created',
  );

  it('filters by case-insensitive prefix match', () => {
    const result = filterAndSortCandidates(candidates, 'INPUT');

    expect(result.every((candidate) => candidate.path.startsWith('input.'))).toBe(true);
    expect(result).toHaveLength(3);
  });

  it('sorts results lexicographically by path', () => {
    const result = filterAndSortCandidates(candidates, 'input');
    const paths = result.map((candidate) => candidate.path);

    expect(paths).toEqual(['input.address', 'input.age', 'input.name']);
  });

  it('limits results to MAXIMUM_VISIBLE_SUGGESTIONS', () => {
    // Create more candidates than the limit.
    const manyCandidates = Array.from({ length: 20 }, (_, index) =>
      makeCandidate(`field${String(index).padStart(2, '0')}`),
    );

    const result = filterAndSortCandidates(manyCandidates, 'field');

    expect(result).toHaveLength(MAXIMUM_VISIBLE_SUGGESTIONS);
  });

  it('returns all candidates (up to max) when query is empty', () => {
    const result = filterAndSortCandidates(candidates, '');

    expect(result).toHaveLength(MAXIMUM_VISIBLE_SUGGESTIONS);
    // Should be sorted lexicographically.
    const paths = result.map((candidate) => candidate.path);
    expect(paths).toEqual(paths.toSorted());
  });

  it('returns empty array when no candidates match', () => {
    const result = filterAndSortCandidates(candidates, 'nonexistent');

    expect(result).toEqual([]);
  });

  it('returns exact match when query matches a path exactly', () => {
    const result = filterAndSortCandidates(candidates, 'input.name');

    expect(result).toHaveLength(1);
    expect(result[0]!.path).toBe('input.name');
  });

  it('matches partial path segments', () => {
    const result = filterAndSortCandidates(candidates, 'config.t');

    expect(result).toHaveLength(1);
    expect(result[0]!.path).toBe('config.timeout');
  });

  it('returns empty array when candidates list is empty', () => {
    const result = filterAndSortCandidates([], 'anything');

    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// mergeCandidates
// ---------------------------------------------------------------------------

describe('mergeCandidates', () => {
  it('deduplicates by path with static candidates taking priority', () => {
    const staticCandidates = [makeCandidate('input.name', 'Static description')];
    const asyncCandidates = [makeCandidate('input.name', 'Async description')];

    const merged = mergeCandidates(staticCandidates, asyncCandidates);

    expect(merged).toHaveLength(1);
    expect(merged[0]!.description).toBe('Static description');
  });

  it('appends unique async candidates after static ones', () => {
    const staticCandidates = [makeCandidate('input.name')];
    const asyncCandidates = [makeCandidate('input.age'), makeCandidate('input.address')];

    const merged = mergeCandidates(staticCandidates, asyncCandidates);

    expect(merged).toHaveLength(3);
    expect(merged[0]!.path).toBe('input.name');
    expect(merged[1]!.path).toBe('input.age');
    expect(merged[2]!.path).toBe('input.address');
  });

  it('handles empty static and non-empty async candidates', () => {
    const asyncCandidates = [makeCandidate('input.name'), makeCandidate('input.age')];

    const merged = mergeCandidates([], asyncCandidates);

    expect(merged).toHaveLength(2);
    expect(merged).toEqual(asyncCandidates);
  });

  it('handles non-empty static and empty async candidates', () => {
    const staticCandidates = [makeCandidate('input.name')];

    const merged = mergeCandidates(staticCandidates, []);

    expect(merged).toHaveLength(1);
    expect(merged).toEqual(staticCandidates);
  });

  it('handles both empty', () => {
    const merged = mergeCandidates([], []);

    expect(merged).toEqual([]);
  });

  it('returns only static set when all async candidates are duplicates', () => {
    const staticCandidates = [makeCandidate('a'), makeCandidate('b')];
    const asyncCandidates = [makeCandidate('a'), makeCandidate('b')];

    const merged = mergeCandidates(staticCandidates, asyncCandidates);

    expect(merged).toHaveLength(2);
    expect(merged[0]!.path).toBe('a');
    expect(merged[1]!.path).toBe('b');
  });

  it('deduplicates within async candidates themselves', () => {
    const asyncCandidates = [makeCandidate('a'), makeCandidate('a'), makeCandidate('b')];

    const merged = mergeCandidates([], asyncCandidates);

    expect(merged).toHaveLength(2);
    expect(merged[0]!.path).toBe('a');
    expect(merged[1]!.path).toBe('b');
  });
});

// ---------------------------------------------------------------------------
// detectTokenQuery
// ---------------------------------------------------------------------------

describe('detectTokenQuery', () => {
  it('detects cursor inside an open token', () => {
    //           0123456
    // Content: "{{inp"
    // Cursor at end (offset 5) => inside open token.
    const state = createStateWithText('{{inp', 5);
    const result = detectTokenQuery(state);

    expect(result).not.toBeNull();
    expect(result!.query).toBe('inp');
    // tokenFrom: doc content starts at 1, {{ at text offset 0, so tokenFrom = 1 + 0 = 1
    expect(result!.tokenFrom).toBe(1);
    // cursorPos: 1 + 5 = 6
    expect(result!.cursorPos).toBe(6);
  });

  it('returns null when cursor is after a closed token', () => {
    //           01234567890123
    // Content: "{{input.name}}"
    // Cursor at end (offset 14).
    const state = createStateWithText('{{input.name}}', 14);
    const result = detectTokenQuery(state);

    expect(result).toBeNull();
  });

  it('returns null when there is no {{ before the cursor', () => {
    const state = createStateWithText('plain text', 5);
    const result = detectTokenQuery(state);

    expect(result).toBeNull();
  });

  it('detects empty query when cursor is right after {{', () => {
    // Content: "{{"
    // Cursor at offset 2.
    const state = createStateWithText('{{', 2);
    const result = detectTokenQuery(state);

    expect(result).not.toBeNull();
    expect(result!.query).toBe('');
  });

  it('detects the second open token when a closed token precedes it', () => {
    // Content: "{{a}} then {{b" (14 chars)
    // Cursor at end (offset 14).
    const state = createStateWithText('{{a}} then {{b', 14);
    const result = detectTokenQuery(state);

    expect(result).not.toBeNull();
    expect(result!.query).toBe('b');
    // The second {{ starts at text offset 11. tokenFrom = 1 + 11 = 12.
    expect(result!.tokenFrom).toBe(12);
  });

  it('returns null for invalid query characters (hyphen)', () => {
    // Content: "{{a-b"
    // The query would be "a-b" which does not match VALID_QUERY_PATTERN.
    const state = createStateWithText('{{a-b', 5);
    const result = detectTokenQuery(state);

    expect(result).toBeNull();
  });

  it('returns null for a non-collapsed (range) selection', () => {
    const state = createStateWithSelection('{{input', 0, 5);
    const result = detectTokenQuery(state);

    expect(result).toBeNull();
  });

  it('returns null when cursor is positioned before the {{ in the text', () => {
    // Content: "before {{query"
    // Cursor at offset 3 (inside "before").
    const state = createStateWithText('before {{query', 3);
    const result = detectTokenQuery(state);

    expect(result).toBeNull();
  });

  it('handles spaces in token by trimming the query', () => {
    // Content: "{{ inp"
    // The raw query is " inp", trimmed to "inp".
    const state = createStateWithText('{{ inp', 6);
    const result = detectTokenQuery(state);

    expect(result).not.toBeNull();
    expect(result!.query).toBe('inp');
  });

  it('handles dot-separated paths in query', () => {
    const state = createStateWithText('{{input.na', 10);
    const result = detectTokenQuery(state);

    expect(result).not.toBeNull();
    expect(result!.query).toBe('input.na');
  });

  it('returns null when {{ is followed by }} before cursor position', () => {
    // Content: "{{done}} more text"
    // Cursor at offset 13 (inside "more text").
    const state = createStateWithText('{{done}} more text', 13);
    const result = detectTokenQuery(state);

    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// findTokenEnd
// ---------------------------------------------------------------------------

describe('findTokenEnd', () => {
  it('finds the end of a complete token when cursor is at the start', () => {
    // Text: "{{input.name}}", tokenFrom = 1 (position of `{{`)
    const state = createStateWithText('{{input.name}}', 0);
    // tokenFrom is doc position 1 (1 = doc open + 0 for paragraph content start)
    const result = findTokenEnd(state, 1);

    // Should point past the closing `}}`
    // `{{input.name}}` has length 14, so end = 1 + 14 = 15
    expect(result).toBe(15);
  });

  it('finds the end of a complete token when cursor is in the middle', () => {
    // Text: "{{input.name}}", tokenFrom = 1
    // Simulates cursor mid-token (e.g., between `input.n` and `ame}}`).
    const state = createStateWithText('{{input.name}}', 8);
    const result = findTokenEnd(state, 1);

    expect(result).toBe(15); // position after the final `}}`
  });

  it('returns null when there is no closing `}}`', () => {
    // Text: "{{input.na" — no closing braces
    const state = createStateWithText('{{input.na', 10);
    const result = findTokenEnd(state, 1);

    expect(result).toBeNull();
  });

  it('finds the first `}}` when multiple tokens exist in the block', () => {
    // Text: "{{input.name}} and {{output.result}}"
    // First token: positions 1..15 (`{{input.name}}`)
    const state = createStateWithText('{{input.name}} and {{output.result}}', 0);
    const result = findTokenEnd(state, 1);

    // First `}}` is at offset 12 within the content after `{{` (offset 2),
    // so result = 1 + 2 + 12 + 2 = 17... let's count:
    // `{{input.name}}` = positions 1..14 in content, so doc pos 1+14=15.
    expect(result).toBe(15);
  });

  it('finds the end of the second token in a block', () => {
    // Text: "{{input.name}} and {{output.result}}"
    // Second token `{{` is at text offset 19, doc position 1 + 19 = 20.
    const state = createStateWithText('{{input.name}} and {{output.result}}', 0);
    const result = findTokenEnd(state, 20);

    // contentStart = 22, `output.result}}` has `}}` at index 13,
    // so return = 22 + 13 + 2 = 37.
    expect(result).toBe(37);
  });
});

// ---------------------------------------------------------------------------
// computeCompletionState
// ---------------------------------------------------------------------------

describe('computeCompletionState', () => {
  const candidates = makeCandidates('input.name', 'input.age', 'input.address', 'output.result');

  const configuration: PlaceholderCompletionConfiguration = {
    candidates,
    minimumQueryLength: 1,
  };

  it('returns INACTIVE_STATE when configuration is undefined', () => {
    const state = createStateWithText('{{inp', 5);
    const transaction = state.tr;

    const result = computeCompletionState(INACTIVE_STATE, transaction, state, undefined);

    expect(result).toEqual(INACTIVE_STATE);
  });

  it('returns INACTIVE_STATE on meta close', () => {
    const state = createStateWithText('{{inp', 5);
    const transaction = state.tr.setMeta(templateCompletionPluginKey, { type: 'close' });

    const result = computeCompletionState(
      { ...INACTIVE_STATE, active: true, query: 'inp' },
      transaction,
      state,
      configuration,
    );

    expect(result).toEqual(INACTIVE_STATE);
  });

  it('updates activeIndex on meta navigate', () => {
    const previousState = {
      active: true,
      query: 'input',
      suggestions: candidates.filter((c) => c.path.startsWith('input')),
      activeIndex: 0,
      tokenFrom: 1,
      cursorPos: 8,
    };
    const state = createStateWithText('{{input', 7);
    const transaction = state.tr.setMeta(templateCompletionPluginKey, {
      type: 'navigate',
      index: 2,
    });

    const result = computeCompletionState(previousState, transaction, state, configuration);

    expect(result.activeIndex).toBe(2);
    expect(result.active).toBe(true);
  });

  it('merges async results and re-filters on meta asyncResults', () => {
    const previousState = {
      active: true,
      query: 'input',
      suggestions: filterAndSortCandidates(candidates, 'input'),
      activeIndex: 0,
      tokenFrom: 1,
      cursorPos: 8,
    };
    const asyncCandidates = [makeCandidate('input.email'), makeCandidate('input.phone')];
    const state = createStateWithText('{{input', 7);
    const transaction = state.tr.setMeta(templateCompletionPluginKey, {
      type: 'asyncResults',
      candidates: asyncCandidates,
    });

    const result = computeCompletionState(previousState, transaction, state, configuration);

    expect(result.active).toBe(true);
    // Should include original + new async candidates that match "input".
    const paths = result.suggestions.map((s) => s.path);
    expect(paths).toContain('input.email');
    expect(paths).toContain('input.phone');
    expect(paths).toContain('input.name');
  });

  it('returns INACTIVE_STATE when query is below minimumQueryLength', () => {
    const configWithMinLength: PlaceholderCompletionConfiguration = {
      candidates,
      minimumQueryLength: 3,
    };
    // Query "in" has length 2, below the minimum of 3.
    const state = createStateWithText('{{in', 4);
    const transaction = state.tr;

    const result = computeCompletionState(INACTIVE_STATE, transaction, state, configWithMinLength);

    expect(result).toEqual(INACTIVE_STATE);
  });

  it('returns active state with filtered suggestions for a valid query', () => {
    const state = createStateWithText('{{input', 7);
    const transaction = state.tr;

    const result = computeCompletionState(INACTIVE_STATE, transaction, state, configuration);

    expect(result.active).toBe(true);
    expect(result.query).toBe('input');
    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(result.suggestions.every((s) => s.path.startsWith('input'))).toBe(true);
  });

  it('resets activeIndex to 0 when query changes', () => {
    const previousState = {
      active: true,
      query: 'input.n',
      suggestions: filterAndSortCandidates(candidates, 'input.n'),
      activeIndex: 2,
      tokenFrom: 1,
      cursorPos: 10,
    };
    // Query changed from "input.n" to "input.a"
    const state = createStateWithText('{{input.a', 9);
    const transaction = state.tr;

    const result = computeCompletionState(previousState, transaction, state, configuration);

    expect(result.active).toBe(true);
    expect(result.query).toBe('input.a');
    expect(result.activeIndex).toBe(0);
  });

  it('preserves activeIndex when query has not changed', () => {
    const previousState = {
      active: true,
      query: 'input',
      suggestions: filterAndSortCandidates(candidates, 'input'),
      activeIndex: 1,
      tokenFrom: 1,
      cursorPos: 8,
    };
    const state = createStateWithText('{{input', 7);
    const transaction = state.tr;

    const result = computeCompletionState(previousState, transaction, state, configuration);

    expect(result.active).toBe(true);
    expect(result.query).toBe('input');
    expect(result.activeIndex).toBe(1);
  });

  it('returns INACTIVE_STATE when cursor is not inside a token', () => {
    const state = createStateWithText('plain text', 5);
    const transaction = state.tr;

    const result = computeCompletionState(INACTIVE_STATE, transaction, state, configuration);

    expect(result).toEqual(INACTIVE_STATE);
  });

  it('returns INACTIVE_STATE when no candidates match and no async lookup configured', () => {
    const state = createStateWithText('{{zzzzz', 7);
    const transaction = state.tr;

    const result = computeCompletionState(INACTIVE_STATE, transaction, state, configuration);

    expect(result).toEqual(INACTIVE_STATE);
  });

  it('returns active state with empty suggestions when async lookup is configured but no static matches', () => {
    const configWithLookup: PlaceholderCompletionConfiguration = {
      candidates,
      minimumQueryLength: 1,
      lookupCandidates: async () => [],
    };
    const state = createStateWithText('{{zzzzz', 7);
    const transaction = state.tr;

    const result = computeCompletionState(INACTIVE_STATE, transaction, state, configWithLookup);

    expect(result.active).toBe(true);
    expect(result.suggestions).toHaveLength(0);
    expect(result.query).toBe('zzzzz');
  });

  it('clamps activeIndex when async results reduce the number of suggestions', () => {
    const previousState = {
      active: true,
      query: 'input',
      suggestions: filterAndSortCandidates(candidates, 'input'),
      activeIndex: 2, // Points to 3rd suggestion.
      tokenFrom: 1,
      cursorPos: 8,
    };

    // Async results that only produce 1 total match after merge+filter.
    const asyncCandidates: PlaceholderCandidate[] = [];
    const configSingle: PlaceholderCompletionConfiguration = {
      candidates: [makeCandidate('input.only')],
      minimumQueryLength: 1,
    };

    const state = createStateWithText('{{input', 7);
    const transaction = state.tr.setMeta(templateCompletionPluginKey, {
      type: 'asyncResults',
      candidates: asyncCandidates,
    });

    const result = computeCompletionState(previousState, transaction, state, configSingle);

    // activeIndex should be clamped to suggestions.length - 1.
    expect(result.activeIndex).toBeLessThanOrEqual(Math.max(0, result.suggestions.length - 1));
  });

  it('returns INACTIVE_STATE when asyncResults produces no suggestions', () => {
    const previousState = {
      active: true,
      query: 'zzzzz',
      suggestions: [],
      activeIndex: 0,
      tokenFrom: 1,
      cursorPos: 8,
    };

    const configNoMatch: PlaceholderCompletionConfiguration = {
      candidates: [],
      minimumQueryLength: 1,
    };

    const state = createStateWithText('{{zzzzz', 7);
    const transaction = state.tr.setMeta(templateCompletionPluginKey, {
      type: 'asyncResults',
      candidates: [makeCandidate('unrelated.path')],
    });

    const result = computeCompletionState(previousState, transaction, state, configNoMatch);

    // "zzzzz" does not match "unrelated.path", so no suggestions after merge+filter.
    expect(result).toEqual(INACTIVE_STATE);
  });

  it('uses default minimumQueryLength of 1 when not specified in configuration', () => {
    const configNoMinLength: PlaceholderCompletionConfiguration = {
      candidates,
    };

    // Single-char query "i" should be sufficient with default minimum of 1.
    const state = createStateWithText('{{i', 3);
    const transaction = state.tr;

    const result = computeCompletionState(INACTIVE_STATE, transaction, state, configNoMinLength);

    expect(result.active).toBe(true);
    expect(result.query).toBe('i');
    expect(result.suggestions.length).toBeGreaterThan(0);
  });
});

describe('template completion async lookup lifecycle', () => {
  const originalDocumentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');

  beforeEach(() => {
    const mockBody = createMockElement();
    const mockDocumentElement = createMockElement();
    const mockDocument = {
      body: mockBody,
      documentElement: mockDocumentElement,
      createElement: () => createMockElement(),
    } as unknown as Document;
    Object.defineProperty(globalThis, 'document', {
      value: mockDocument,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    if (originalDocumentDescriptor) {
      Object.defineProperty(globalThis, 'document', originalDocumentDescriptor);
      return;
    }
    Reflect.deleteProperty(globalThis, 'document');
  });

  it('swallows aborted async lookup rejections without uncaught errors', async () => {
    const abortedQueries: string[] = [];
    const unhandledRejections: unknown[] = [];
    const onUnhandledRejection = (reason: unknown) => {
      unhandledRejections.push(reason);
    };
    process.on('unhandledRejection', onUnhandledRejection);

    try {
      const deferredResolutions = new Map<string, (value: PlaceholderCandidate[]) => void>();
      const configuration: PlaceholderCompletionConfiguration = {
        candidates: [],
        minimumQueryLength: 1,
        lookupDebounceMs: 0,
        lookupCandidates: (query, signal) =>
          new Promise<PlaceholderCandidate[]>((resolve, reject) => {
            deferredResolutions.set(query, resolve);
            signal.addEventListener(
              'abort',
              () => {
                abortedQueries.push(query);
                reject(new Error(`aborted:${query}`));
              },
              { once: true },
            );
          }),
      };

      const harness = await createCompletionHarness(configuration);

      harness.typeText('a');
      await flushTimers();

      harness.typeText('b');
      await flushTimers();

      deferredResolutions.get('ab')?.([]);
      await flushMicrotasks();

      harness.pluginView.destroy?.();
      await flushTimers();

      expect(abortedQueries).toContain('a');
      expect(unhandledRejections).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandledRejection);
    }
  });

  it('keeps suggestions from the latest query when rapid typing causes overlapping lookups', async () => {
    type DeferredLookup = {
      resolve: (value: PlaceholderCandidate[]) => void;
      signal: AbortSignal;
    };
    const deferredByQuery = new Map<string, DeferredLookup>();

    const configuration: PlaceholderCompletionConfiguration = {
      candidates: [],
      minimumQueryLength: 1,
      lookupDebounceMs: 0,
      lookupCandidates: (query, signal) =>
        new Promise<PlaceholderCandidate[]>((resolve) => {
          deferredByQuery.set(query, { resolve, signal });
        }),
    };

    const harness = await createCompletionHarness(configuration);
    harness.typeText('a');
    await flushTimers();

    harness.typeText('b');
    await flushTimers();

    deferredByQuery.get('ab')?.resolve([makeCandidate('ab.latest')]);
    await flushMicrotasks();

    deferredByQuery.get('a')?.resolve([makeCandidate('a.stale')]);
    await flushMicrotasks();

    const pluginState = harness.getPluginState();

    expect(deferredByQuery.get('a')?.signal.aborted).toBe(true);
    expect(pluginState?.query).toBe('ab');
    expect(pluginState?.suggestions.map((candidate) => candidate.path)).toEqual(['ab.latest']);

    harness.pluginView.destroy?.();
  });
});
