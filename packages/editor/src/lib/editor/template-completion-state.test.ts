import type {
  PlaceholderCandidate,
  PlaceholderCompletionConfiguration,
} from '@lostgradient/markdown';
import { describe, expect, it } from 'bun:test';
import { filterAndSortCandidates } from './template-completion-query.js';
import {
  computeCompletionState,
  INACTIVE_STATE,
  templateCompletionPluginKey,
  type CompletionState,
} from './template-completion-state.js';
import {
  completionSource,
  createStateWithText,
  makeCandidate,
  makeCandidates,
} from './template-completion-test-utilities.js';

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
      completionSource(configuration),
    );

    expect(result).toEqual(INACTIVE_STATE);
  });

  it('updates activeIndex on meta navigate', () => {
    const previousState: CompletionState = {
      ...INACTIVE_STATE,
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

    const result = computeCompletionState(
      previousState,
      transaction,
      state,
      completionSource(configuration),
    );

    expect(result.activeIndex).toBe(2);
    expect(result.active).toBe(true);
  });

  it('ignores navigation metadata with a non-finite or out-of-range index', () => {
    const previousState: CompletionState = {
      ...INACTIVE_STATE,
      active: true,
      query: 'input',
      suggestions: filterAndSortCandidates(candidates, 'input'),
      activeIndex: 0,
      tokenFrom: 1,
      cursorPos: 8,
    };
    const state = createStateWithText('{{input', 7);
    const transaction = state.tr.setMeta(templateCompletionPluginKey, {
      type: 'navigate',
      index: Number.POSITIVE_INFINITY,
    });

    const result = computeCompletionState(
      previousState,
      transaction,
      state,
      completionSource(configuration),
    );

    expect(result.activeIndex).toBe(0);
  });

  it('ignores async metadata containing malformed candidates', () => {
    const previousState: CompletionState = {
      ...INACTIVE_STATE,
      active: true,
      query: 'input',
      suggestions: filterAndSortCandidates(candidates, 'input'),
      activeIndex: 0,
      tokenFrom: 1,
      cursorPos: 8,
    };
    const state = createStateWithText('{{input', 7);
    const transaction = state.tr.setMeta(templateCompletionPluginKey, {
      type: 'asyncResults',
      candidates: [{ path: 'input.bad', types: ['not-a-type'] }],
    });

    const result = computeCompletionState(
      previousState,
      transaction,
      state,
      completionSource(configuration),
    );

    expect(result.suggestions).toEqual(previousState.suggestions);
  });

  it('merges async results and re-filters on meta asyncResults', () => {
    const previousState: CompletionState = {
      ...INACTIVE_STATE,
      active: true,
      query: 'input',
      suggestions: filterAndSortCandidates(candidates, 'input'),
      activeIndex: 0,
      tokenFrom: 1,
      cursorPos: 8,
    };
    const asyncCandidates = [makeCandidate('input.email'), makeCandidate('input.phone')];
    const source = completionSource(configuration);
    const state = createStateWithText('{{input', 7);
    const transaction = state.tr.setMeta(templateCompletionPluginKey, {
      type: 'asyncResults',
      query: 'input',
      candidates: asyncCandidates,
      source,
    });

    const result = computeCompletionState(previousState, transaction, state, source);

    expect(result.active).toBe(true);
    // Should include original + new async candidates that match "input".
    const paths = result.suggestions.map((s) => s.path);
    expect(paths).toContain('input.email');
    expect(paths).toContain('input.phone');
    expect(paths).toContain('input.name');
  });

  it('ignores async results requested under a different configuration', () => {
    const previousState: CompletionState = {
      ...INACTIVE_STATE,
      active: true,
      query: 'input',
      suggestions: filterAndSortCandidates(candidates, 'input'),
    };
    const state = createStateWithText('{{input', 7);
    const transaction = state.tr.setMeta(templateCompletionPluginKey, {
      type: 'asyncResults',
      query: 'input',
      candidates: [makeCandidate('input.stale')],
      source: completionSource(configuration),
    });

    const result = computeCompletionState(
      previousState,
      transaction,
      state,
      completionSource(configuration),
    );

    expect(result.suggestions.map((candidate) => candidate.path)).not.toContain('input.stale');
  });

  it('returns INACTIVE_STATE when query is below minimumQueryLength', () => {
    const configWithMinLength: PlaceholderCompletionConfiguration = {
      candidates,
      minimumQueryLength: 3,
    };
    // Query "in" has length 2, below the minimum of 3.
    const state = createStateWithText('{{in', 4);
    const transaction = state.tr;

    const result = computeCompletionState(
      INACTIVE_STATE,
      transaction,
      state,
      completionSource(configWithMinLength),
    );

    expect(result).toEqual(INACTIVE_STATE);
  });

  it('returns active state with filtered suggestions for a valid query', () => {
    const state = createStateWithText('{{input', 7);
    const transaction = state.tr;

    const result = computeCompletionState(
      INACTIVE_STATE,
      transaction,
      state,
      completionSource(configuration),
    );

    expect(result.active).toBe(true);
    expect(result.query).toBe('input');
    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(result.suggestions.every((s) => s.path.startsWith('input'))).toBe(true);
  });

  it('resets activeIndex to 0 when query changes', () => {
    const previousState: CompletionState = {
      ...INACTIVE_STATE,
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

    const result = computeCompletionState(
      previousState,
      transaction,
      state,
      completionSource(configuration),
    );

    expect(result.active).toBe(true);
    expect(result.query).toBe('input.a');
    expect(result.activeIndex).toBe(0);
  });

  it('preserves activeIndex when query has not changed', () => {
    const previousState: CompletionState = {
      ...INACTIVE_STATE,
      active: true,
      query: 'input',
      suggestions: filterAndSortCandidates(candidates, 'input'),
      activeIndex: 1,
      tokenFrom: 1,
      cursorPos: 8,
    };
    const state = createStateWithText('{{input', 7);
    const transaction = state.tr;

    const result = computeCompletionState(
      previousState,
      transaction,
      state,
      completionSource(configuration),
    );

    expect(result.active).toBe(true);
    expect(result.query).toBe('input');
    expect(result.activeIndex).toBe(1);
  });

  it('returns INACTIVE_STATE when cursor is not inside a token', () => {
    const state = createStateWithText('plain text', 5);
    const transaction = state.tr;

    const result = computeCompletionState(
      INACTIVE_STATE,
      transaction,
      state,
      completionSource(configuration),
    );

    expect(result).toEqual(INACTIVE_STATE);
  });

  it('stays active with no suggestions when nothing matches, so the view can announce it', () => {
    const state = createStateWithText('{{zzzzz', 7);
    const transaction = state.tr;

    const result = computeCompletionState(
      INACTIVE_STATE,
      transaction,
      state,
      completionSource(configuration),
    );

    expect(result.active).toBe(true);
    expect(result.suggestions).toEqual([]);
  });

  it('returns active state with empty suggestions when async lookup is configured but no static matches', () => {
    const configWithLookup: PlaceholderCompletionConfiguration = {
      candidates,
      minimumQueryLength: 1,
      lookupCandidates: async () => [],
    };
    const state = createStateWithText('{{zzzzz', 7);
    const transaction = state.tr;

    const result = computeCompletionState(
      INACTIVE_STATE,
      transaction,
      state,
      completionSource(configWithLookup),
    );

    expect(result.active).toBe(true);
    expect(result.suggestions).toHaveLength(0);
    expect(result.query).toBe('zzzzz');
  });

  it('clamps activeIndex when async results reduce the number of suggestions', () => {
    const previousState: CompletionState = {
      ...INACTIVE_STATE,
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

    const source = completionSource(configSingle);
    const state = createStateWithText('{{input', 7);
    const transaction = state.tr.setMeta(templateCompletionPluginKey, {
      type: 'asyncResults',
      query: 'input',
      candidates: asyncCandidates,
      source,
    });

    const result = computeCompletionState(previousState, transaction, state, source);

    // activeIndex should be clamped to suggestions.length - 1.
    expect(result.activeIndex).toBeLessThanOrEqual(Math.max(0, result.suggestions.length - 1));
  });

  it('keeps an active empty result when asyncResults produces no suggestions', () => {
    const previousState: CompletionState = {
      ...INACTIVE_STATE,
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

    const source = completionSource(configNoMatch);
    const state = createStateWithText('{{zzzzz', 7);
    const transaction = state.tr.setMeta(templateCompletionPluginKey, {
      type: 'asyncResults',
      query: 'zzzzz',
      candidates: [makeCandidate('unrelated.path')],
      source,
    });

    const result = computeCompletionState(previousState, transaction, state, source);

    // "zzzzz" does not match "unrelated.path", so no suggestions after merge+filter.
    expect(result.active).toBe(true);
    expect(result.suggestions).toEqual([]);
  });

  it('uses default minimumQueryLength of 1 when not specified in configuration', () => {
    const configNoMinLength: PlaceholderCompletionConfiguration = {
      candidates,
    };

    // Single-char query "i" should be sufficient with default minimum of 1.
    const state = createStateWithText('{{i', 3);
    const transaction = state.tr;

    const result = computeCompletionState(
      INACTIVE_STATE,
      transaction,
      state,
      completionSource(configNoMinLength),
    );

    expect(result.active).toBe(true);
    expect(result.query).toBe('i');
    expect(result.suggestions.length).toBeGreaterThan(0);
  });
});
