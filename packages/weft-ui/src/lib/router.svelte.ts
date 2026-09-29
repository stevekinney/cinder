/**
 * History-API router (plan §4, §8, T1.3). Frozen after the Phase 1
 * Foundation gate — see PROJECT-BRIEF "Shared contracts". Parses the current
 * location against the route table in `src/app/routes.ts` into a
 * rune-backed `{ route, params, search }` triple (`router.current`);
 * `navigate()`/`back()`/`forward()`/`href()` are the only way surfaces
 * should touch `window.history`, so the whole app agrees on one history-API
 * story with no SvelteKit involved. `window` is always present — this is an
 * SPA with no SSR entry point (plan §1.2) and every test file gets a
 * happy-dom `window` from `tests/setup.ts` — so this module reads it
 * directly rather than guarding a case that can't occur.
 */
import { routes, type RouteDefinition } from '../app/routes.ts';

export interface RouteMatch {
  readonly pattern: string;
  readonly params: Readonly<Record<string, string>>;
}

/** The router's fully parsed view of the current location (plan §4, §8). */
export interface RouteState {
  /** The matched route definition, or `null` when no owned pattern matches. */
  readonly route: RouteDefinition | null;
  /** Named path params extracted from `route.pattern`, e.g. `{ id: 'wf_123' }`. */
  readonly params: Readonly<Record<string, string>>;
  /** The current location's query string. */
  readonly search: URLSearchParams;
}

function matchPattern(pattern: string, pathname: string): Record<string, string> | null {
  const patternSegments = pattern.split('/').filter((segment) => segment.length > 0);
  const pathSegments = pathname.split('/').filter((segment) => segment.length > 0);

  if (patternSegments.length !== pathSegments.length) return null;

  const params: Record<string, string> = {};
  for (const [index, patternSegment] of patternSegments.entries()) {
    const pathSegment = pathSegments[index];
    if (pathSegment === undefined) return null;

    if (patternSegment.startsWith(':')) {
      params[patternSegment.slice(1)] = decodeURIComponent(pathSegment);
      continue;
    }

    if (patternSegment !== pathSegment) return null;
  }

  return params;
}

/**
 * Builds a workflow detail path. Dot-only identifiers use a query-carried
 * escape because browsers normalize those exact path segments before the
 * client router can read them; every other identifier retains its legacy URL.
 */
export function workflowDetailPath(
  workflowId: string,
  search: URLSearchParams = new URLSearchParams(),
): string {
  const nextSearch = new URLSearchParams(search);
  const dotOnly = workflowId === '.' || workflowId === '..';
  if (dotOnly) nextSearch.set('__weft_workflow_id', workflowId);
  const query = nextSearch.toString();
  return `/workflows/${dotOnly ? '_' : encodeURIComponent(workflowId)}${query ? `?${query}` : ''}`;
}

interface RouteDefinitionMatch {
  readonly definition: RouteDefinition;
  readonly params: Record<string, string>;
}

/** Finds the first route definition (with its extracted params) matching `pathname`. */
function findRouteDefinition(
  pathname: string,
  definitions: readonly RouteDefinition[],
): RouteDefinitionMatch | null {
  for (const definition of definitions) {
    const params = matchPattern(definition.pattern, pathname);
    if (params) return { definition, params };
  }

  return null;
}

/** Finds the first route definition whose pattern matches `pathname`. */
export function matchRoute(
  pathname: string,
  definitions: readonly RouteDefinition[] = routes,
): RouteMatch | null {
  const found = findRouteDefinition(pathname, definitions);
  return found ? { pattern: found.definition.pattern, params: found.params } : null;
}

class ConsoleRouter {
  pathname = $state(window.location.pathname);
  #searchString = $state(window.location.search);

  constructor() {
    window.addEventListener('popstate', () => {
      this.pathname = window.location.pathname;
      this.#searchString = window.location.search;
    });
  }

  /** The current location's query string, live (not a frozen snapshot). */
  get search(): URLSearchParams {
    return new URLSearchParams(this.#searchString);
  }

  /** The route matching the current `pathname`, or `null` for an unowned path. */
  get match(): RouteMatch | null {
    return matchRoute(this.pathname);
  }

  /** The fully parsed `{ route, params, search }` view of the current location. */
  get current(): RouteState {
    const found = findRouteDefinition(this.pathname, routes);
    const search = this.search;
    const escapedWorkflowId =
      found?.definition.pattern === '/workflows/:id' ? search.get('__weft_workflow_id') : null;
    const params =
      (escapedWorkflowId === '.' || escapedWorkflowId === '..') && found
        ? { ...found.params, id: escapedWorkflowId }
        : (found?.params ?? {});
    return {
      route: found?.definition ?? null,
      params,
      search,
    };
  }

  /**
   * Pushes `path` onto browser history (or replaces the current entry with
   * `options.replace`) and updates the reactive route state. `path` may
   * include a query string (e.g. `/workflows?status=running`) — the browser
   * resolves it, so `pathname`/`search` are read back from
   * `window.location` rather than re-parsed here.
   */
  navigate(path: string, options?: { readonly replace?: boolean }): void {
    if (options?.replace) {
      window.history.replaceState(null, '', path);
    } else {
      window.history.pushState(null, '', path);
    }
    this.pathname = window.location.pathname;
    this.#searchString = window.location.search;
  }

  /** Goes back one entry in browser history (mirrors the browser's back button). */
  back(): void {
    window.history.back();
  }

  /** Goes forward one entry in browser history (mirrors the browser's forward button). */
  forward(): void {
    window.history.forward();
  }

  /** Resolves an `href` for a link. Identity today; a seam for a future base path. */
  href(path: string): string {
    return path;
  }
}

export const router = new ConsoleRouter();
