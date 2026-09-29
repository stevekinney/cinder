/**
 * Tests for the history-API router (plan §4, §8, T1.3).
 *
 * happy-dom's default `window.location` is `about:blank` (no origin), and
 * `history.pushState` is a silent no-op from a non-hierarchical origin —
 * every test that touches the reactive `router` singleton first calls
 * `resetLocation()` to give the window a real `http://localhost/` origin
 * (via happy-dom's own `happyDOM.setURL`, exposed on `window` by
 * `tests/setup.ts`'s global preload) so `pushState`/`replaceState` actually
 * take effect, exactly as they would from a real page load.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import { Window, type DetachedWindowAPI } from 'happy-dom';

import { routes } from '../app/routes.ts';
import { matchRoute, router, workflowDetailPath } from './router.svelte.ts';

function happyDomAPI(): DetachedWindowAPI {
  if (!(window instanceof Window)) {
    throw new Error('expected the test window to be backed by happy-dom');
  }
  return window.happyDOM;
}

/** Gives `window.location` a real origin and lands the router at `path`. */
function resetLocation(path = '/'): void {
  happyDomAPI().setURL('http://localhost/');
  router.navigate(path, { replace: true });
}

describe('matchRoute', () => {
  const definitions = [
    { pattern: '/', load: () => Promise.reject(new Error('unused')) },
    { pattern: '/workflows', load: () => Promise.reject(new Error('unused')) },
    { pattern: '/workflows/:id', load: () => Promise.reject(new Error('unused')) },
  ];

  test('matches a static pattern exactly', () => {
    expect(matchRoute('/workflows', definitions)).toEqual({
      pattern: '/workflows',
      params: {},
    });
  });

  test('matches the root pattern only for the empty path', () => {
    expect(matchRoute('/', definitions)).toEqual({ pattern: '/', params: {} });
    expect(matchRoute('/workflows', definitions)?.pattern).not.toBe('/');
  });

  test('extracts and decodes a dynamic segment', () => {
    expect(matchRoute('/workflows/wf%20123', definitions)).toEqual({
      pattern: '/workflows/:id',
      params: { id: 'wf 123' },
    });
  });

  test('returns null when segment counts differ', () => {
    expect(matchRoute('/workflows/wf_1/timeline', definitions)).toBeNull();
    expect(matchRoute('/', [{ pattern: '/workflows', load: definitions[1]!.load }])).toBeNull();
  });

  test('normalizes a trailing slash away (empty segments are filtered)', () => {
    expect(matchRoute('/workflows/', definitions)).toEqual({
      pattern: '/workflows',
      params: {},
    });
  });

  test('first definition wins when multiple patterns could match', () => {
    const ambiguous = [
      { pattern: '/workflows/:id', load: definitions[2]!.load },
      { pattern: '/workflows/new', load: definitions[1]!.load },
    ];
    expect(matchRoute('/workflows/new', ambiguous)?.pattern).toBe('/workflows/:id');
  });

  test('returns null for a completely unowned path', () => {
    expect(matchRoute('/not-a-route', definitions)).toBeNull();
  });

  test('every pattern in the real route table matches its own literal path', () => {
    for (const definition of routes) {
      const literalPath = definition.pattern.replace(/:[^/]+/g, 'sample-id');
      expect(matchRoute(literalPath)?.pattern).toBe(definition.pattern);
    }
  });
});

describe('router singleton', () => {
  beforeEach(() => {
    resetLocation('/');
  });

  test('navigate() updates pathname and match', () => {
    router.navigate('/workflows');
    expect(router.pathname).toBe('/workflows');
    expect(router.match).toEqual({ pattern: '/workflows', params: {} });
  });

  test('navigate() to a dynamic route decodes params', () => {
    router.navigate('/workflows/wf_123');
    expect(router.match).toEqual({ pattern: '/workflows/:id', params: { id: 'wf_123' } });
  });

  test('workflow detail paths preserve dot-only identifiers without changing legacy tilde links', () => {
    for (const workflowId of ['.', '..']) {
      router.navigate(workflowDetailPath(workflowId));
      expect(router.current.params['id']).toBe(workflowId);
    }

    router.navigate('/workflows/~legacy-link');
    expect(router.current.params['id']).toBe('~legacy-link');
    router.navigate(workflowDetailPath('~new-link'));
    expect(router.current.params['id']).toBe('~new-link');
  });

  test('navigate() to an unowned path yields no match', () => {
    router.navigate('/does-not-exist');
    expect(router.pathname).toBe('/does-not-exist');
    expect(router.match).toBeNull();
  });

  test('navigate() with a query string updates search', () => {
    router.navigate('/workflows?status=running&status=failed');
    expect(router.search.getAll('status')).toEqual(['running', 'failed']);
  });

  test('navigate() without a query string clears search', () => {
    router.navigate('/workflows?status=running');
    expect(router.search.get('status')).toBe('running');

    router.navigate('/workflows');
    expect(router.search.toString()).toBe('');
  });

  test('current combines route, params, and search into one snapshot', () => {
    router.navigate('/workflows/wf_123?status=failed');

    const current = router.current;
    expect(current.route).toBe(routes.find((r) => r.pattern === '/workflows/:id') ?? null);
    expect(current.params).toEqual({ id: 'wf_123' });
    expect(current.search.get('status')).toBe('failed');
  });

  test('current.route is null and params is empty for an unowned path', () => {
    router.navigate('/nowhere');
    expect(router.current.route).toBeNull();
    expect(router.current.params).toEqual({});
  });

  test('href() resolves a path to itself', () => {
    expect(router.href('/workflows/wf_123')).toBe('/workflows/wf_123');
  });

  test('back() and forward() traverse pushed history entries', () => {
    router.navigate('/workflows');
    router.navigate('/schedules');

    router.back();
    expect(router.pathname).toBe('/workflows');

    router.forward();
    expect(router.pathname).toBe('/schedules');
  });

  test('navigate(..., { replace: true }) does not grow the history stack', () => {
    router.navigate('/workflows');
    router.navigate('/schedules', { replace: true });

    router.back();
    // The replace collapsed onto /workflows's entry, so back() from
    // /schedules lands on whatever preceded /workflows — the "/" baseline
    // `resetLocation` established — not on /workflows itself.
    expect(router.pathname).toBe('/');
  });

  test('an external popstate (browser back/forward button) syncs pathname and search', () => {
    router.navigate('/workflows');
    router.navigate('/schedules?view=list');

    window.history.back();
    expect(router.pathname).toBe('/workflows');

    window.history.forward();
    expect(router.pathname).toBe('/schedules');
    expect(router.search.get('view')).toBe('list');
  });
});
