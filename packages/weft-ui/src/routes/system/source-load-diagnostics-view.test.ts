/**
 * Unit tests for `source-load-diagnostics-view.ts` (WFT-116) — the pure
 * `weft.catalog.diagnostics` → render-ready mapping, exercised without a
 * DOM. Covers the runtime guard's accept/reject surface (every field, both
 * optionals, present-but-wrong-typed), the dynamic/not-dynamic split, and
 * every bounded state/category label including the unrecognized fallbacks.
 */
import { describe, expect, it } from 'bun:test';

import {
  ACTIVE_SOURCE_POLL_MS,
  failureCategoryDescription,
  isCatalogDiagnosticsLike,
  KNOWN_FAILURE_CATEGORIES,
  KNOWN_SOURCE_LOAD_STATES,
  SETTLED_SOURCE_POLL_MS,
  sourceLoadPollInterval,
  sourceLoadStateDescription,
  sourceLoadStateLabel,
  sourceLoadStateTone,
  summarizeSourceLoad,
  type CatalogDiagnosticsLike,
} from './source-load-diagnostics-view.ts';

function diagnostics(overrides: Partial<CatalogDiagnosticsLike> = {}): CatalogDiagnosticsLike {
  return {
    name: 'dynamic-invoice',
    revision: 'r1',
    installed: true,
    active: false,
    ...overrides,
  };
}

function source(
  overrides: Partial<NonNullable<CatalogDiagnosticsLike['source']>> = {},
): NonNullable<CatalogDiagnosticsLike['source']> {
  return {
    kind: 'module',
    requestedRevision: 'r1',
    state: 'ready',
    waiterCount: 0,
    ...overrides,
  };
}

describe('isCatalogDiagnosticsLike', () => {
  it('accepts a minimal response with no source block', () => {
    expect(isCatalogDiagnosticsLike(diagnostics())).toBe(true);
  });

  it('accepts a response whose source block carries both optional fields', () => {
    expect(
      isCatalogDiagnosticsLike(
        diagnostics({
          source: source({ state: 'failed', loadDurationMs: 12, lastFailureCategory: 'resource' }),
        }),
      ),
    ).toBe(true);
  });

  it('rejects null, primitives, and arrays outright', () => {
    expect(isCatalogDiagnosticsLike(null)).toBe(false);
    expect(isCatalogDiagnosticsLike(42)).toBe(false);
    expect(isCatalogDiagnosticsLike('r1')).toBe(false);
    expect(isCatalogDiagnosticsLike(undefined)).toBe(false);
    expect(isCatalogDiagnosticsLike([])).toBe(false);
  });

  it.each([
    ['name', { name: 1 }],
    ['revision', { revision: 1 }],
    ['installed', { installed: 'yes' }],
    ['active', { active: 'no' }],
  ])('rejects a response whose %s has the wrong type', (_field, override) => {
    expect(isCatalogDiagnosticsLike({ ...diagnostics(), ...override })).toBe(false);
  });

  it.each([
    ['kind', { kind: 1 }],
    ['requestedRevision', { requestedRevision: 1 }],
    ['state', { state: 1 }],
    ['waiterCount', { waiterCount: '0' }],
  ])('rejects a source block whose %s has the wrong type', (_field, override) => {
    expect(
      isCatalogDiagnosticsLike({ ...diagnostics(), source: { ...source(), ...override } }),
    ).toBe(false);
  });

  it('rejects a source block that is not an object', () => {
    expect(isCatalogDiagnosticsLike({ ...diagnostics(), source: 'module' })).toBe(false);
    expect(isCatalogDiagnosticsLike({ ...diagnostics(), source: null })).toBe(false);
  });

  it('rejects a present-but-wrong-typed loadDurationMs rather than treating it as absent', () => {
    expect(
      isCatalogDiagnosticsLike({
        ...diagnostics(),
        source: { ...source(), loadDurationMs: 'fast' },
      }),
    ).toBe(false);
  });

  it('rejects a present-but-wrong-typed lastFailureCategory rather than treating it as absent', () => {
    expect(
      isCatalogDiagnosticsLike({
        ...diagnostics(),
        source: { ...source(), lastFailureCategory: 7 },
      }),
    ).toBe(false);
  });
});

describe('summarizeSourceLoad', () => {
  it('reports an installed revision with no dynamic source, claiming nothing about how it got there', () => {
    const summary = summarizeSourceLoad(diagnostics({ installed: true }));
    expect(summary.kind).toBe('not-dynamic');
    if (summary.kind !== 'not-dynamic') throw new Error('expected not-dynamic');
    expect(summary.installed).toBe(true);
    expect(summary.message).toContain('No dynamic source is registered');
    expect(summary.message).toContain('installed in the catalog');
    // `weft.catalog.diagnostics` cannot tell an eagerly registered revision
    // from one installed via `weft.workflows.revisions.install`, so this copy
    // must never claim either.
    expect(summary.message).not.toContain('eager');
  });

  it('distinguishes a key that is neither dynamic nor installed', () => {
    const summary = summarizeSourceLoad(diagnostics({ installed: false }));
    if (summary.kind !== 'not-dynamic') throw new Error('expected not-dynamic');
    expect(summary.installed).toBe(false);
    expect(summary.message).toContain('not installed');
  });

  it('maps a ready source to its full meta grid', () => {
    const summary = summarizeSourceLoad(
      diagnostics({ source: source({ state: 'ready', loadDurationMs: 1_500, waiterCount: 0 }) }),
    );
    if (summary.kind !== 'dynamic') throw new Error('expected dynamic');
    expect(summary.stateLabel).toBe('Ready');
    expect(summary.tone).toBe('positive');
    expect(summary.lastFailureCategory).toBeUndefined();
    expect(summary.meta.map((item) => item.term)).toEqual([
      'Source kind',
      'Requested revision',
      'Load duration',
      'Waiters',
      'Last failure',
      'In catalog',
    ]);
    expect(summary.meta[2]?.value).toBe('1s');
    expect(summary.meta[3]?.value).toBe('0 callers waiting');
    expect(summary.meta[4]?.value).toBe('None recorded');
    expect(summary.meta[5]?.value).toBe('Installed');
  });

  it('reports a ready-but-removed revision as not installed, and never calls ready "installed"', () => {
    // `removeWorkflowRevision()` does not reset process-local source
    // diagnostics, so `ready` and `installed: false` legitimately arrive in the
    // same response. `state` describes the last load; only `installed` answers
    // "is it in the catalog right now".
    const summary = summarizeSourceLoad(
      diagnostics({
        installed: false,
        source: source({ state: 'ready', loadDurationMs: 5 }),
      }),
    );
    if (summary.kind !== 'dynamic') throw new Error('expected dynamic');
    expect(summary.installed).toBe(false);
    expect(summary.meta[5]?.value).toBe('Not installed');
    expect(summary.stateDescription).toBe('The last load completed successfully.');
    expect(summary.stateDescription).not.toContain('installed');
  });

  it('renders an absent load duration as "Not loaded yet" for an idle source, never as zero', () => {
    const summary = summarizeSourceLoad(diagnostics({ source: source({ state: 'idle' }) }));
    if (summary.kind !== 'dynamic') throw new Error('expected dynamic');
    expect(summary.meta[2]?.value).toBe('Not loaded yet');
    expect(summary.tone).toBe('neutral');
    // `idle` is also what an UNREGISTERED revision of a registered name
    // reports, so the copy must not confirm the revision is registered.
    expect(summary.stateDescription).toContain('No load has been recorded');
    expect(summary.stateDescription).toContain('may not');
  });

  it('renders a cancelled attempt as duration-not-recorded, never-started', () => {
    const summary = summarizeSourceLoad(
      diagnostics({ source: source({ state: 'cancelled', lastFailureCategory: 'cancellation' }) }),
    );
    if (summary.kind !== 'dynamic') throw new Error('expected dynamic');
    // The engine's cancellation transition records no duration, so this row
    // legitimately has none — but "Not loaded yet" would contradict the state.
    expect(summary.meta[2]?.value).toBe('Not recorded');
    expect(summary.tone).toBe('attention');
  });

  it('says a cancelled load may still be running, because Weft leaves it running', () => {
    const summary = summarizeSourceLoad(diagnostics({ source: source({ state: 'cancelled' }) }));
    if (summary.kind !== 'dynamic') throw new Error('expected dynamic');
    // `cancelled` means every WAITER released, not that the load stopped:
    // `source-resolution.ts` deliberately lets the shared load run on, and it
    // can still install. Copy that said "cancelled before it finished" claimed
    // the work stopped.
    expect(summary.stateDescription).toContain('may still be running');
    expect(summary.stateDescription).not.toContain('before it finished');
  });

  it('renders an absent load duration as "In flight" while loading', () => {
    const summary = summarizeSourceLoad(
      diagnostics({ source: source({ state: 'loading', waiterCount: 1 }) }),
    );
    if (summary.kind !== 'dynamic') throw new Error('expected dynamic');
    expect(summary.meta[2]?.value).toBe('In flight');
    expect(summary.meta[3]?.value).toBe('1 caller waiting');
    expect(summary.tone).toBe('progress');
  });

  it('surfaces a bounded failure category with its explanatory copy', () => {
    const summary = summarizeSourceLoad(
      diagnostics({
        source: source({ state: 'failed', lastFailureCategory: 'timeout', loadDurationMs: 30_000 }),
      }),
    );
    if (summary.kind !== 'dynamic') throw new Error('expected dynamic');
    expect(summary.tone).toBe('attention');
    expect(summary.lastFailureCategory).toBe('timeout');
    expect(summary.lastFailureDescription).toBe('Execution exceeded a configured deadline.');
    expect(summary.meta[4]?.value).toBe('timeout');
  });

  it('renders an unrecognized failure category without inventing copy for it', () => {
    const summary = summarizeSourceLoad(
      diagnostics({ source: source({ state: 'failed', lastFailureCategory: 'quantum' }) }),
    );
    if (summary.kind !== 'dynamic') throw new Error('expected dynamic');
    expect(summary.lastFailureCategory).toBe('quantum');
    expect(summary.lastFailureDescription).toBeUndefined();
  });

  it('renders an unrecognized state as its raw value with no description and a neutral tone', () => {
    const summary = summarizeSourceLoad(diagnostics({ source: source({ state: 'evicted' }) }));
    if (summary.kind !== 'dynamic') throw new Error('expected dynamic');
    expect(summary.stateLabel).toBe('evicted');
    expect(summary.stateDescription).toBeUndefined();
    expect(summary.tone).toBe('neutral');
  });

  it('carries the source kind and requested revision through verbatim', () => {
    const summary = summarizeSourceLoad(
      diagnostics({ source: source({ kind: 'module', requestedRevision: 'candidate-9' }) }),
    );
    if (summary.kind !== 'dynamic') throw new Error('expected dynamic');
    expect(summary.sourceKind).toBe('module');
    expect(summary.requestedRevision).toBe('candidate-9');
    expect(summary.meta[1]?.title).toBe('candidate-9');
  });
});

describe('label tables', () => {
  it.each([...KNOWN_SOURCE_LOAD_STATES])('labels and describes the %s state', (state) => {
    expect(sourceLoadStateLabel(state)).not.toBe(state);
    expect(sourceLoadStateDescription(state)).toBeDefined();
    expect(sourceLoadStateTone(state)).toBeDefined();
  });

  it.each([...KNOWN_FAILURE_CATEGORIES])('describes the %s failure category', (category) => {
    expect(failureCategoryDescription(category)).toBeDefined();
  });

  it('states each category’s canonical meaning rather than a load-specific guess', () => {
    // Regression guard: an earlier table read `resource` as "could not reach or
    // read its source", which is neither what the category means nor how a load
    // failure is classified — `source-diagnostics.ts` defaults every ordinary
    // loader error to `application`.
    expect(failureCategoryDescription('resource')).toContain('quota');
    expect(failureCategoryDescription('resource')).not.toContain('source');
    expect(failureCategoryDescription('application')).toContain('default classification');
    expect(failureCategoryDescription('system')).toContain('infrastructure');
  });

  it('falls back honestly for unrecognized values', () => {
    expect(sourceLoadStateLabel('warp')).toBe('warp');
    expect(sourceLoadStateDescription('warp')).toBeUndefined();
    expect(failureCategoryDescription('warp')).toBeUndefined();
    expect(sourceLoadStateTone('warp')).toBe('neutral');
  });
});

describe('sourceLoadPollInterval', () => {
  it('polls a load in flight at the fast cadence', () => {
    expect(
      sourceLoadPollInterval(
        summarizeSourceLoad(diagnostics({ source: source({ state: 'loading' }) })),
      ),
    ).toBe(ACTIVE_SOURCE_POLL_MS);
  });

  it.each(['idle', 'ready', 'failed', 'cancelled'])(
    'keeps polling the settled %s state, slowly — another caller can start a load this console never invalidates for',
    (state) => {
      expect(
        sourceLoadPollInterval(summarizeSourceLoad(diagnostics({ source: source({ state }) }))),
      ).toBe(SETTLED_SOURCE_POLL_MS);
    },
  );

  it('keeps polling a name with no dynamic source — registerSource() can add one at any time', () => {
    // `registerSource()` is synchronous and in-memory: it writes nothing to the
    // catalog, so there is no write for this console to observe. A lookup that
    // ran first would otherwise read "no dynamic source" for the whole session.
    expect(sourceLoadPollInterval(summarizeSourceLoad(diagnostics()))).toBe(SETTLED_SOURCE_POLL_MS);
  });

  it('polls a settled source far less often than one in flight', () => {
    expect(SETTLED_SOURCE_POLL_MS).toBeGreaterThan(ACTIVE_SOURCE_POLL_MS);
  });
});
