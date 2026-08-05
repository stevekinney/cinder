import { describe, expect, it } from 'bun:test';

import { matchRoute, type RouteDefinition } from './route-table.ts';

function req(pathname: string, method = 'GET'): Request {
  return new Request(`http://localhost:5555${pathname}`, { method });
}

describe('matchRoute', () => {
  const routes: RouteDefinition[] = [
    { method: 'GET', pattern: /^\/ping$/, handler: () => new Response('pong') },
    {
      method: 'GET',
      pattern: /^\/page\/([^/]+)$/,
      handler: ({ match }) => new Response(match[1]),
    },
  ];

  it('returns the first matching route context, including populated match groups', () => {
    const result = matchRoute(routes, req('/page/button'));
    expect(result).not.toBeNull();
    expect(result?.route.pattern).toBe(routes[1]!.pattern);
    expect(result?.context.match[1]).toBe('button');
  });

  it('returns null for a pathname with no matching route', () => {
    expect(matchRoute(routes, req('/not-a-route'))).toBeNull();
  });

  it('returns null when the method does not match a route whose pattern would otherwise match', () => {
    expect(matchRoute(routes, req('/ping', 'POST'))).toBeNull();
  });

  it('tries patterns in order — a more specific route listed first wins', () => {
    const orderedRoutes: RouteDefinition[] = [
      { method: 'GET', pattern: /^\/styles\.css$/, handler: () => new Response('exact') },
      { method: 'GET', pattern: /^\/styles\/(.+)$/, handler: () => new Response('wildcard') },
    ];
    const result = matchRoute(orderedRoutes, req('/styles.css'));
    expect(result?.route.pattern).toBe(orderedRoutes[0]!.pattern);
  });
});
