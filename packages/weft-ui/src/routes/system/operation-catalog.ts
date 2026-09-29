/**
 * Builds the Operation catalog (plan §9.7 T7.4; design `Weft UI.dc.html`
 * "System" § OPERATION CATALOG) by combining weft's `openapi.json` and
 * `openrpc.json` discovery documents client-side — "sourced from the
 * discovery docs" per the plan, not a dedicated catalog endpoint (none
 * exists).
 *
 * ## The "scope" column is honestly empty, not guessed
 *
 * Verified against a live `openapi.json`/`openrpc.json` pair (weft v0.11.0,
 * `src/server/openapi.ts`/`openrpc.ts`): NEITHER document advertises an
 * operation's required authorization scope anywhere. `openapi.json`'s
 * `security` schemes are `http`/`apiKey` (not `oauth2`/`openIdConnect`), so
 * OpenAPI's own scope-list mechanism doesn't apply to them; `openrpc.json`
 * has no per-method scope field either (`x-weft-parameterizedAccess` exists
 * for the one operation whose access varies by a parameter value, not as a
 * general scope advertisement). Hand-maintaining a local operation→scope map
 * by reading weft's server source was rejected — the plan is explicit that
 * "no hand-maintained API types; drift is caught by bumping the dependency"
 * is the house rule, and a local map would silently rot the moment an
 * operation's `access` changes upstream. Filed upstream instead:
 * https://github.com/stevekinney/weft/issues/737 (advertise required scope
 * per operation in the discovery documents). Until it lands,
 * `OperationCatalogRow.scope` is `undefined` and the catalog/`PermissionMatrix`
 * UI says so explicitly rather than rendering a fabricated scope.
 *
 * Transport flags (`http`/`jsonRpc`/`mcp`) ARE derivable today: an
 * operation's presence in `openapi.json` `paths` means it has a live REST
 * binding, presence in `openrpc.json` `methods` means it's JSON-RPC-live, and
 * a method's own `x-weft-mcp` field (present only when `mcpExposable`) means
 * it's exposed as an MCP tool.
 */

const DIRECT_ROUTE_OPERATION_IDS: ReadonlySet<string> = new Set([
  'healthCheck',
  'getMetrics',
  'openApiDocument',
  'openRpcDocument',
  'asyncApiDocument',
  'mcpDiscovery',
  'apiCatalog',
]);

/** Synthetic introspection method every OpenRPC document carries — not a product operation. */
const META_METHOD_NAME = 'rpc.discover';

export interface OperationCatalogRow {
  readonly name: string;
  /** Always `undefined` today — see module doc. */
  readonly scope: undefined;
  readonly restMethod: string | undefined;
  readonly restPath: string | undefined;
  readonly jsonRpc: boolean;
  readonly mcp: boolean;
  readonly mcpToolName: string | undefined;
  readonly summary: string | undefined;
  readonly tags: readonly string[];
}

interface OpenApiOperationObject {
  readonly operationId?: string;
  readonly summary?: string;
  readonly tags?: readonly string[];
}

export interface OpenApiDocumentLike {
  readonly paths?: Readonly<Record<string, Readonly<Record<string, OpenApiOperationObject>>>>;
}

interface OpenRpcMethodLike {
  readonly name: string;
  readonly summary?: string;
  readonly tags?: readonly { readonly name: string }[];
  readonly 'x-weft-mcp'?: { readonly toolName?: string };
}

export interface OpenRpcDocumentLike {
  readonly methods?: readonly OpenRpcMethodLike[];
}

const REST_METHOD_ORDER: readonly string[] = ['get', 'post', 'put', 'patch', 'delete'];

interface RestBindingInfo {
  readonly method: string;
  readonly path: string;
  readonly summary: string | undefined;
  readonly tags: readonly string[];
}

/** Indexes `openapi.json` paths by `operationId`, preferring the first HTTP method encountered per weft's own emission order when a path/verb pair repeats (never observed in practice, kept for determinism). */
function indexRestBindings(document: OpenApiDocumentLike): Map<string, RestBindingInfo> {
  const index = new Map<string, RestBindingInfo>();
  const paths = document.paths ?? {};

  for (const [path, methods] of Object.entries(paths)) {
    for (const verb of REST_METHOD_ORDER) {
      const operation = methods[verb];
      if (!operation?.operationId) continue;
      if (index.has(operation.operationId)) continue;
      index.set(operation.operationId, {
        method: verb.toUpperCase(),
        path,
        summary: operation.summary,
        tags: operation.tags ?? [],
      });
    }
  }

  return index;
}

function compareCodepoint(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function catalogRowTags(
  rest: RestBindingInfo | undefined,
  rpc: OpenRpcMethodLike | undefined,
): readonly string[] {
  if (rpc?.tags) return rpc.tags.map((tag) => tag.name);
  return rest?.tags ?? [];
}

/** Builds one catalog row from whatever REST/JSON-RPC info was found for `name` (at least one is always defined — see `buildOperationCatalog`'s call site). */
function buildCatalogRow(
  name: string,
  rest: RestBindingInfo | undefined,
  rpc: OpenRpcMethodLike | undefined,
): OperationCatalogRow {
  const mcpToolName = rpc?.['x-weft-mcp']?.toolName;

  return {
    name,
    scope: undefined,
    restMethod: rest?.method,
    restPath: rest?.path,
    jsonRpc: rpc !== undefined,
    mcp: mcpToolName !== undefined,
    mcpToolName,
    summary: rpc?.summary ?? rest?.summary,
    tags: catalogRowTags(rest, rpc),
  };
}

/**
 * Combines the two discovery documents into a sorted, de-duplicated catalog.
 * A `null`/`undefined` document (a document kind that failed to fetch, e.g.
 * a 503) degrades that document's contribution to empty rather than
 * throwing — callers show the per-document fault separately (Discovery tab)
 * and the catalog itself just reflects whatever loaded.
 */
export function buildOperationCatalog(
  openapi: OpenApiDocumentLike | null | undefined,
  openrpc: OpenRpcDocumentLike | null | undefined,
): readonly OperationCatalogRow[] {
  const restIndex = indexRestBindings(openapi ?? {});
  const rpcMethods = (openrpc?.methods ?? []).filter((method) => method.name !== META_METHOD_NAME);
  const rpcByName = new Map(rpcMethods.map((method) => [method.name, method]));

  const names = new Set<string>([...restIndex.keys(), ...rpcByName.keys()]);

  const rows = [...names]
    .filter((name) => !DIRECT_ROUTE_OPERATION_IDS.has(name))
    .map((name) => buildCatalogRow(name, restIndex.get(name), rpcByName.get(name)));

  return rows.toSorted((a, b) => compareCodepoint(a.name, b.name));
}

/** Case-insensitive substring match over name/summary/tags — the catalog's search box. */
export function filterOperationCatalog(
  rows: readonly OperationCatalogRow[],
  query: string,
): readonly OperationCatalogRow[] {
  const needle = query.trim().toLowerCase();
  if (needle === '') return rows;
  return rows.filter((row) => {
    const haystack = [row.name, row.summary ?? '', ...row.tags].join(' ').toLowerCase();
    return haystack.includes(needle);
  });
}
