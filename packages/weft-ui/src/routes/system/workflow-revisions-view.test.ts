/**
 * Unit tests for `workflow-revisions-view.ts` (WFT-115): structural
 * guarding + row projection for the Revisions panel.
 */
import { describe, expect, test } from 'bun:test';

import {
  isBackgroundRefreshing,
  isWorkflowRevisionRecordLike,
  rowMeta,
  workflowRevisionRows,
  type WorkflowRevisionRecordSource,
} from './workflow-revisions-view.ts';

function manifest(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    manifestVersion: 1,
    name: 'order-processing',
    workflowVersion: '0.0.0',
    revision: 'order-processing-rev-1',
    contractHash: 'sha256:hash-1',
    contract: { name: 'order-processing', workflowVersion: '0.0.0' },
    ...overrides,
  };
}

function record(overrides: Partial<WorkflowRevisionRecordSource> = {}): unknown {
  return { manifest: manifest(), installedAt: 1_700_000_000_000, ...overrides };
}

describe('isWorkflowRevisionRecordLike', () => {
  test('accepts a well-formed record', () => {
    expect(isWorkflowRevisionRecordLike(record())).toBe(true);
  });

  test('rejects non-objects', () => {
    expect(isWorkflowRevisionRecordLike(null)).toBe(false);
    expect(isWorkflowRevisionRecordLike(undefined)).toBe(false);
    expect(isWorkflowRevisionRecordLike('nope')).toBe(false);
    expect(isWorkflowRevisionRecordLike(42)).toBe(false);
  });

  test('rejects a record missing installedAt', () => {
    const value = record();
    if (value === null || typeof value !== 'object') throw new Error('record fixture malformed');
    const rest = Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'installedAt'));
    expect(isWorkflowRevisionRecordLike(rest)).toBe(false);
  });

  test('rejects a manifest missing contractHash', () => {
    const { contractHash: _contractHash, ...bad } = manifest();
    expect(isWorkflowRevisionRecordLike({ manifest: bad, installedAt: 1 })).toBe(false);
  });

  test('rejects a manifest whose manifestVersion is not a number', () => {
    expect(
      isWorkflowRevisionRecordLike({
        manifest: manifest({ manifestVersion: '1' }),
        installedAt: 1,
      }),
    ).toBe(false);
  });

  test('rejects a manifest with no contract object', () => {
    expect(
      isWorkflowRevisionRecordLike({ manifest: manifest({ contract: undefined }), installedAt: 1 }),
    ).toBe(false);
  });
});

describe('workflowRevisionRows', () => {
  test('rejects the whole response — returns undefined, not a partial list — when any record is malformed', () => {
    const rows = workflowRevisionRows([record(), { not: 'a record' }, null, 42], {
      revision: 'order-processing-rev-1',
      generation: 1,
      activatedAt: 1,
    });
    expect(rows).toBeUndefined();
  });

  test('a malformed entry that happens to share the name of the active revision is still rejected wholesale, never silently mislabeling the surviving rows as "Installed" only', () => {
    // Regression case: an earlier version filtered per-record, so a
    // malformed entry for the ACTIVE revision left every surviving row
    // "Installed" (no Active badge) and suppressed the "never activated"
    // note — because the pointer itself was still non-null. Any malformed
    // entry anywhere in the array must now reject the whole response.
    const rows = workflowRevisionRows(
      [record({ manifest: manifest({ revision: 'rev-a' }) }), { manifest: 'not-an-object' }],
      { revision: 'rev-a', generation: 1, activatedAt: 1 },
    );
    expect(rows).toBeUndefined();
  });

  test('flags exactly one row active per the active pointer', () => {
    const rows = workflowRevisionRows(
      [
        record({ manifest: manifest({ revision: 'rev-a' }) }),
        record({ manifest: manifest({ revision: 'rev-b' }) }),
        record({ manifest: manifest({ revision: 'rev-c' }) }),
      ],
      { revision: 'rev-b', generation: 2, activatedAt: 1_700_000_000_000 },
    );
    expect(rows).toBeDefined();
    expect(rows?.filter((row) => row.isActive)).toHaveLength(1);
    expect(rows?.find((row) => row.isActive)?.revision).toBe('rev-b');
  });

  test('no row is active when the active pointer is null', () => {
    const rows = workflowRevisionRows([record()], null);
    expect(rows?.every((row) => !row.isActive)).toBe(true);
  });

  test('no row is active when a non-null active pointer names a revision absent from the records — accepted cross-query-race behavior, not malformed data', () => {
    // `revisionsQuery` and `activeQuery` are independent fetches
    // (`workflow-revisions-panel.svelte`) — a real race, or a revision
    // uninstalled between the two responses, can leave a valid non-null
    // pointer naming a revision this particular records array doesn't
    // include. This is a legitimate (if momentary) state, not a structural
    // guard failure: every row simply resolves `isActive: false`, and the
    // panel renders an explicit note for exactly this case rather than
    // silently reading as "never activated".
    const rows = workflowRevisionRows([record({ manifest: manifest({ revision: 'rev-a' }) })], {
      revision: 'rev-missing',
      generation: 1,
      activatedAt: 1,
    });
    expect(rows).toBeDefined();
    expect(rows?.every((row) => !row.isActive)).toBe(true);
  });

  test('an empty array is a valid (not malformed) empty response', () => {
    expect(workflowRevisionRows([], null)).toEqual([]);
  });

  test('sorts rows by revision, codepoint order', () => {
    const rows = workflowRevisionRows(
      [
        record({ manifest: manifest({ revision: 'rev-c' }) }),
        record({ manifest: manifest({ revision: 'rev-a' }) }),
        record({ manifest: manifest({ revision: 'rev-b' }) }),
      ],
      null,
    );
    expect(rows?.map((row) => row.revision)).toEqual(['rev-a', 'rev-b', 'rev-c']);
  });

  test('projects workflowVersion, contractHash, manifestVersion, and installedAt verbatim', () => {
    const rows = workflowRevisionRows(
      [
        record({
          manifest: manifest({ workflowVersion: '2.0.0', contractHash: 'sha256:h2' }),
          installedAt: 42,
        }),
      ],
      null,
    );
    expect(rows?.[0]).toEqual({
      revision: 'order-processing-rev-1',
      workflowVersion: '2.0.0',
      contractHash: 'sha256:h2',
      manifestVersion: 1,
      installedAt: 42,
      isActive: false,
    });
  });
});

describe('rowMeta', () => {
  test('projects workflow version, a truncated-but-full-title contract hash, manifest version, and installed-at in display order', () => {
    const rows = workflowRevisionRows(
      [
        record({
          manifest: manifest({
            workflowVersion: '3.1.4',
            contractHash: 'sha256:a-very-long-contract-hash-value',
          }),
          installedAt: 1_700_000_000_000,
        }),
      ],
      null,
    );
    const row = rows?.[0];
    if (!row) throw new Error('fixture invariant: row must exist');

    const items = rowMeta(row);
    expect(items.map((item) => item.term)).toEqual([
      'Workflow version',
      'Contract hash',
      'Manifest version',
      'Installed at',
    ]);
    expect(items[0]).toEqual({
      term: 'Workflow version',
      value: '3.1.4',
      title: undefined,
      mono: false,
    });
    const contractHashItem = items[1];
    expect(contractHashItem?.mono).toBe(true);
    expect(contractHashItem?.title).toBe('sha256:a-very-long-contract-hash-value');
    expect(contractHashItem?.value).not.toBe(contractHashItem?.title);
    expect(items[2]).toEqual({
      term: 'Manifest version',
      value: '1',
      title: undefined,
      mono: false,
    });
  });
});

describe('isBackgroundRefreshing', () => {
  test('false while neither query is fetching', () => {
    expect(
      isBackgroundRefreshing({ isFetching: false, data: ['a'] }, { isFetching: false, data: null }),
    ).toBe(false);
  });

  test('false for the INITIAL load — fetching with no resolved data yet, even though isFetching is true', () => {
    expect(
      isBackgroundRefreshing(
        { isFetching: true, data: undefined },
        { isFetching: true, data: undefined },
      ),
    ).toBe(false);
  });

  test('true when revisionsQuery is fetching a value it has already resolved once before', () => {
    expect(
      isBackgroundRefreshing({ isFetching: true, data: ['a'] }, { isFetching: false, data: null }),
    ).toBe(true);
  });

  test('true when activeQuery is fetching, even though its own resolved value is null ("never activated" is a legitimate resolved state, not "still loading")', () => {
    expect(
      isBackgroundRefreshing({ isFetching: false, data: ['a'] }, { isFetching: true, data: null }),
    ).toBe(true);
  });
});
