/**
 * Table-driven proof that every row of `playground-server.ts`'s `ROUTES`
 * array is actually wired into `matchRoute` — the mechanical evidence that
 * the route table matches the 19-row table `playground-server.ts`'s own
 * module doc comment documents, not just that the existing behavioral route
 * tests still happen to pass.
 *
 * `matchRoute` is pure pattern matching — it never calls a route's handler —
 * so these sample pathnames don't need any real component/fixture to exist.
 */

import { describe, expect, it } from 'bun:test';

import { ROUTES } from './playground-server.ts';
import { matchRoute } from './route-table.ts';

function req(pathname: string): Request {
  return new Request(`http://localhost:5555${pathname}`);
}

const SAMPLE_PATHNAME_BY_ROW_INDEX: readonly string[] = [
  '/social.png',
  '/ping',
  '/ready',
  '/events',
  '/styles.css',
  '/styles/foo.css',
  '/components/button/button.css',
  '/package-components/chat/chat/chat.css',
  '/bundle/button/primary.js',
  '/page-bundle/button.js',
  '/fixture-bundle/fixture-button-basic-abc123.js',
  '/shell-bundle/shell.js',
  '/api/manifest',
  '/api/manifest/button',
  '/api/documentation/button',
  '/page/button',
  '/example-src/button/primary',
  '/c/button',
  '/',
];

describe('ROUTES table', () => {
  it('has exactly 19 entries (18 distinct URL patterns; /styles.css and /styles/* share one handler function)', () => {
    expect(ROUTES).toHaveLength(19);
  });

  it.each(SAMPLE_PATHNAME_BY_ROW_INDEX.map((pathname, index) => [index, pathname] as const))(
    "row %i: a request to %s matches that row's exact pattern",
    (index, pathname) => {
      const result = matchRoute(ROUTES, req(pathname));
      expect(result).not.toBeNull();
      expect(result?.route.pattern).toBe(ROUTES[index]!.pattern);
    },
  );

  it('tries patterns in order: /styles.css matches the exact-match row, not the /styles/* wildcard', () => {
    const result = matchRoute(ROUTES, req('/styles.css'));
    expect(result?.route.pattern).toBe(ROUTES[4]!.pattern); // row 5 (0-indexed: 4)
    expect(result?.route.pattern).not.toBe(ROUTES[5]!.pattern); // row 6 (0-indexed: 5)
  });
});
