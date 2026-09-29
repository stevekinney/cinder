import { describe, expect, test } from 'bun:test';

import { AUTHORIZATION_SCOPES } from '../../lib/scopes.svelte.ts';
import {
  domainColumnsFromTags,
  SCOPE_MATRIX_ROWS,
  scopeDomainCellState,
} from './scope-domain-matrix.ts';

describe('SCOPE_MATRIX_ROWS', () => {
  test('one row per authorization scope, in declaration order', () => {
    expect(SCOPE_MATRIX_ROWS.map((row) => row.id)).toEqual([...AUTHORIZATION_SCOPES]);
  });
});

describe('domainColumnsFromTags', () => {
  test('sorts and de-duplicates', () => {
    expect(domainColumnsFromTags(['System', 'Workflows', 'System', 'Reviews'])).toEqual([
      { id: 'Reviews', label: 'Reviews' },
      { id: 'System', label: 'System' },
      { id: 'Workflows', label: 'Workflows' },
    ]);
  });

  test('empty for no tags', () => {
    expect(domainColumnsFromTags([])).toEqual([]);
  });
});

describe('scopeDomainCellState', () => {
  test('matches a scope prefix to its domain tag, case-insensitively', () => {
    expect(
      scopeDomainCellState(
        { id: 'workflows:read', label: 'workflows:read' },
        { id: 'Workflows', label: 'Workflows' },
      ),
    ).toBe('granted');
  });

  test('not-applicable when the domain differs', () => {
    expect(
      scopeDomainCellState(
        { id: 'workflows:read', label: 'workflows:read' },
        { id: 'Reviews', label: 'Reviews' },
      ),
    ).toBe('not-applicable');
  });

  test('handles multi-segment tags/scopes correctly (prefix-only match)', () => {
    expect(
      scopeDomainCellState(
        { id: 'system:admin', label: 'system:admin' },
        { id: 'System', label: 'System' },
      ),
    ).toBe('granted');
  });
});
