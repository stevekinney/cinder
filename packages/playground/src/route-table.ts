export type RouteContext = { request: Request; url: URL; match: RegExpMatchArray };

export type RouteDefinition = {
  method: 'GET';
  pattern: RegExp;
  handler: (context: RouteContext) => Response | Promise<Response>;
};

/** First route whose method and pattern match; `null` when none do. */
export function matchRoute(
  routes: readonly RouteDefinition[],
  request: Request,
): { route: RouteDefinition; context: RouteContext } | null {
  const url = new URL(request.url);
  for (const route of routes) {
    if (request.method !== route.method) continue;
    const match = url.pathname.match(route.pattern);
    if (match !== null) return { route, context: { request, url, match } };
  }
  return null;
}
