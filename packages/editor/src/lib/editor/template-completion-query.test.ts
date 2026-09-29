import { describe, expect, it } from 'bun:test';
import {
  detectTokenQuery,
  filterAndSortCandidates,
  MAXIMUM_VISIBLE_SUGGESTIONS,
  mergeCandidates,
} from './template-completion-query.js';
import {
  createStateWithSelection,
  createStateWithText,
  makeCandidate,
  makeCandidates,
} from './template-completion-test-utilities.js';

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

  it('returns every match, not just the visible rows, so all stay reachable', () => {
    const manyCandidates = Array.from({ length: 20 }, (_, index) =>
      makeCandidate(`field${String(index).padStart(2, '0')}`),
    );

    const result = filterAndSortCandidates(manyCandidates, 'field');

    expect(MAXIMUM_VISIBLE_SUGGESTIONS).toBe(8);
    expect(result).toHaveLength(20);
  });

  it('returns every candidate sorted by path in code-unit order when the query is empty', () => {
    const result = filterAndSortCandidates(
      [...candidates, makeCandidate('Zeta'), makeCandidate('alpha')],
      '',
    );

    const paths = result.map((candidate) => candidate.path);
    expect(paths).toHaveLength(candidates.length + 2);
    expect(paths[0]).toBe('Zeta');
    expect(paths).toEqual(paths.toSorted((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
  });

  it('filters case-insensitively but keeps canonical case', () => {
    const result = filterAndSortCandidates([makeCandidate('User.Name')], 'user.n');

    expect(result.map((candidate) => candidate.path)).toEqual(['User.Name']);
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
