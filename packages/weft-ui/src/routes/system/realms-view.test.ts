import { describe, expect, test } from 'bun:test';

import {
  realmDiagnosticsRows,
  realmStateBadgeVariant,
  totalRealmCount,
  type RealmDiagnosticsSource,
} from './realms-view.ts';

describe('realmDiagnosticsRows', () => {
  test('returns one row per realm, sorted by (name, revision)', () => {
    const source: RealmDiagnosticsSource = {
      pools: [
        {
          name: 'checkout',
          revision: 'revision-b',
          revisionActive: true,
          realms: [
            { state: 'active', realmGeneration: 'gen-1', restartCount: 0, pendingTurnCount: 1 },
          ],
        },
        {
          name: 'checkout',
          revision: 'revision-a',
          revisionActive: false,
          realms: [
            { state: 'draining', realmGeneration: 'gen-0', restartCount: 2, pendingTurnCount: 0 },
          ],
        },
      ],
    };

    const rows = realmDiagnosticsRows(source);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ name: 'checkout', revision: 'revision-a', state: 'draining' });
    expect(rows[1]).toMatchObject({ name: 'checkout', revision: 'revision-b', state: 'active' });
  });

  test('emits one row with a null realm state for a pool tracking no realms', () => {
    const source: RealmDiagnosticsSource = {
      pools: [{ name: 'checkout', revision: 'revision-a', revisionActive: true, realms: [] }],
    };

    const rows = realmDiagnosticsRows(source);
    expect(rows).toEqual([
      {
        key: 'checkout:revision-a',
        name: 'checkout',
        revision: 'revision-a',
        revisionActive: true,
        realmIndex: null,
        state: null,
        realmGeneration: null,
        restartCount: null,
        pendingTurnCount: null,
      },
    ]);
  });

  test('emits one row per realm when a pool tracks several', () => {
    const source: RealmDiagnosticsSource = {
      pools: [
        {
          name: 'checkout',
          revision: 'revision-a',
          revisionActive: true,
          realms: [
            { state: 'active', realmGeneration: 'gen-1', restartCount: 0, pendingTurnCount: 1 },
            { state: 'ready', realmGeneration: 'gen-1', restartCount: 0, pendingTurnCount: 0 },
          ],
        },
      ],
    };

    const rows = realmDiagnosticsRows(source);
    expect(rows.map((row) => row.key)).toEqual(['checkout:revision-a:0', 'checkout:revision-a:1']);
  });
});

describe('totalRealmCount', () => {
  test('sums realms across every pool', () => {
    const source: RealmDiagnosticsSource = {
      pools: [
        {
          name: 'checkout',
          revision: 'revision-a',
          revisionActive: true,
          realms: [
            { state: 'active', realmGeneration: 'gen-1', restartCount: 0, pendingTurnCount: 0 },
          ],
        },
        { name: 'checkout', revision: 'revision-b', revisionActive: false, realms: [] },
      ],
    };
    expect(totalRealmCount(source)).toBe(1);
  });

  test('is zero for no pools', () => {
    expect(totalRealmCount({ pools: [] })).toBe(0);
  });
});

describe('realmStateBadgeVariant', () => {
  test('maps every lifecycle state to a badge variant', () => {
    expect(realmStateBadgeVariant('active')).toBe('success');
    expect(realmStateBadgeVariant('ready')).toBe('success');
    expect(realmStateBadgeVariant('warming')).toBe('warning');
    expect(realmStateBadgeVariant('draining')).toBe('warning');
    expect(realmStateBadgeVariant('crashed')).toBe('danger');
    expect(realmStateBadgeVariant('terminated')).toBe('neutral');
  });
});
