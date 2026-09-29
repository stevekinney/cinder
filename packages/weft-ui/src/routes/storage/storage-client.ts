/**
 * Raw KV storage REST client (plan §9.6, T7.1).
 *
 * Storage is exposed by the server's REST bindings rather than the generated
 * JSON-RPC operation catalog. This client uses the public `HttpClient`
 * connection fields with `fetch` and translates non-success responses into
 * the same `HttpClientError` shape used by the rest of the console.
 *
 * ## Scope
 *
 * Every route requires `storage:admin`; the route gate in `index.svelte`
 * reflects that server authorization contract.
 *
 * ## Value encoding (asymmetric across routes — verified against
 * `src/server/operations/storage.ts`'s REST bindings)
 *
 * - `GET` response body: raw `application/octet-stream` bytes.
 * - `PUT` request body: raw `application/octet-stream` bytes.
 * - `GET /v1/storage` (scan) response body: `application/x-ndjson`, one
 *   `{"key": string, "value": string}` object per line, `value` base64.
 * - `batch`/`conditional-batch` request bodies: JSON, `value`/`expectedValue`
 *   fields base64.
 * - `conditional-batch` response body: JSON `{ applied: boolean }`.
 *
 */
import { HttpClientError, isFaultCode, type FaultCode, type HttpClient } from '@lostgradient/weft';

/** The slice of `HttpClient` this module needs — its resolved connection, never a typed operation. */
export type StorageConnection = Pick<HttpClient, 'baseUrl' | 'headers'>;

export interface StorageScanEntry {
  readonly key: string;
  readonly value: Uint8Array;
}

export interface StorageScanOptions {
  readonly prefix?: string;
  readonly gt?: string;
  readonly gte?: string;
  readonly lt?: string;
  readonly lte?: string;
  readonly limit?: number;
  readonly reverse?: boolean;
}

/** One page of a scan. `nextCursor` is the last key on the page — pass it as `gt` to fetch the next page (cursor-based, not offset-based). `undefined` when the page came back shorter than the requested `limit` (no more rows). */
export interface StorageScanPage {
  readonly entries: readonly StorageScanEntry[];
  readonly nextCursor: string | undefined;
}

export type StorageBatchOperationInput =
  | { readonly type: 'put'; readonly key: string; readonly value: Uint8Array }
  | { readonly type: 'delete'; readonly key: string };

export interface StorageConditionInput {
  readonly key: string;
  readonly expectedValue: Uint8Array | null;
}

export interface StorageConditionalBatchResult {
  readonly applied: boolean;
}

const STORAGE_BASE_PATH = '/v1/storage';

function storageUrl(connection: StorageConnection, path: string): string {
  return `${connection.baseUrl}${STORAGE_BASE_PATH}${path}`;
}

function storageHeaders(connection: StorageConnection, contentType?: string): Headers {
  const headers = new Headers(connection.headers);
  if (contentType !== undefined) headers.set('Content-Type', contentType);
  return headers;
}

function encodeKeyForPath(key: string): string {
  return encodeURIComponent(key);
}

function encodeBytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decodeBase64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function encodeBatchOperation(operation: StorageBatchOperationInput): unknown {
  if (operation.type === 'put') {
    return { type: 'put', key: operation.key, value: encodeBytesToBase64(operation.value) };
  }
  return { type: 'delete', key: operation.key };
}

function encodeCondition(condition: StorageConditionInput): unknown {
  return {
    key: condition.key,
    expectedValue:
      condition.expectedValue === null ? null : encodeBytesToBase64(condition.expectedValue),
  };
}

/**
 * Parses a non-ok storage response body into the shape `HttpClientError`
 * needs. Every storage REST binding shapes its fault with `shapeRestFault`
 * (`src/server/operations/storage.ts`, every `shapeFault: shapeRestFault`),
 * which — unlike the structured `faultToHttpResponse` most other REST
 * bindings use — ALWAYS emits the flat `{ error: string }` body with no
 * `code` field, for every fault code, not only the masked `EngineFailure`
 * case. So `faultCode` is realistically always `undefined` here in
 * practice; the structured-body branch below is kept only for
 * forward-compatibility should that change upstream. Callers that need to
 * distinguish fault codes for storage errors (e.g.
 * `probeConditionalBatchSupported`) key off `HttpClientError.status`
 * instead — `classifyFault` (`../../lib/faults.ts`) already does the same
 * status-based fallback for any error with no `faultCode`.
 */
function fallbackErrorMessage(response: Response): string {
  return response.statusText || `Request failed with status ${response.status}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

/** `{ error: { code, message } }` — the structured fault body. */
function parseStructuredErrorBody(
  errorField: unknown,
): { message: string; faultCode?: FaultCode } | undefined {
  if (!isRecord(errorField)) return undefined;

  const code = errorField['code'];
  const message = errorField['message'];
  if (typeof message !== 'string') return undefined;

  return typeof code === 'string' && isFaultCode(code) ? { message, faultCode: code } : { message };
}

/** `{ error: string }` — the flat `shapeRestFault` body every storage REST binding actually sends (see this function's caller's doc comment). */
function parseFlatErrorBody(errorField: unknown): { message: string } | undefined {
  return typeof errorField === 'string' ? { message: errorField } : undefined;
}

async function parseStorageErrorBody(
  response: Response,
): Promise<{ message: string; faultCode?: FaultCode }> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { message: fallbackErrorMessage(response) };
  }

  const errorField = isRecord(body) ? body['error'] : undefined;
  return (
    parseStructuredErrorBody(errorField) ??
    parseFlatErrorBody(errorField) ?? { message: fallbackErrorMessage(response) }
  );
}

async function throwStorageError(response: Response): Promise<never> {
  const { message, faultCode } = await parseStorageErrorBody(response);
  throw new HttpClientError(response.status, message, faultCode === undefined ? {} : { faultCode });
}

/** `GET /v1/storage/:key`. A missing key resolves `null` (mirrors `HttpClient`'s own GET-404-is-null convention), never throws for "not found". */
export async function storageGet(
  connection: StorageConnection,
  key: string,
): Promise<Uint8Array | null> {
  const response = await fetch(storageUrl(connection, `/${encodeKeyForPath(key)}`), {
    method: 'GET',
    headers: storageHeaders(connection),
  });

  if (response.status === 404) return null;
  if (!response.ok) return throwStorageError(response);

  return new Uint8Array(await response.arrayBuffer());
}

/** `PUT /v1/storage/:key`. */
export async function storagePut(
  connection: StorageConnection,
  key: string,
  value: Uint8Array,
): Promise<void> {
  const response = await fetch(storageUrl(connection, `/${encodeKeyForPath(key)}`), {
    method: 'PUT',
    headers: storageHeaders(connection, 'application/octet-stream'),
    // `Blob` sidesteps a TypeScript-lib/Bun-lib generic mismatch on plain
    // `Uint8Array` bodies (`Uint8Array<ArrayBufferLike>` vs. the stricter
    // `Uint8Array<ArrayBuffer>` `BlobPart`/`BodyInit` expects) without a type
    // assertion; `.slice()` also guarantees a fresh `ArrayBuffer`-backed copy
    // (never `SharedArrayBuffer`) that can't mutate underneath the request.
    body: new Blob([value.slice()]),
  });

  if (!response.ok) await throwStorageError(response);
}

/** `DELETE /v1/storage/:key`. */
export async function storageDelete(connection: StorageConnection, key: string): Promise<void> {
  const response = await fetch(storageUrl(connection, `/${encodeKeyForPath(key)}`), {
    method: 'DELETE',
    headers: storageHeaders(connection),
  });

  if (!response.ok) await throwStorageError(response);
}

/**
 * `GET /v1/storage` (NDJSON). One page at a time — `options.limit` bounds
 * the page (the console never passes the server's 10,000-row max; callers
 * default it low, mirroring the "never expose the API max for browsing"
 * convention lists follow elsewhere in the plan). Continue with
 * `{ ...options, gt: page.nextCursor }` for the next page.
 */
function buildScanQueryParams(options: StorageScanOptions): URLSearchParams {
  const params = new URLSearchParams();
  params.set('prefix', options.prefix ?? '');
  if (options.limit !== undefined) params.set('limit', String(options.limit));
  if (options.reverse !== undefined) params.set('reverse', String(options.reverse));
  for (const field of ['gt', 'gte', 'lt', 'lte'] as const) {
    const value = options[field];
    if (value !== undefined) params.set(field, value);
  }
  return params;
}

function parseNdjsonScanEntries(text: string): StorageScanEntry[] {
  const entries: StorageScanEntry[] = [];
  for (const line of text.split('\n')) {
    if (line.length === 0) continue;
    const row: unknown = JSON.parse(line);
    if (!isRecord(row) || typeof row['key'] !== 'string' || typeof row['value'] !== 'string') {
      throw new Error('Malformed storage scan row');
    }
    entries.push({ key: row['key'], value: decodeBase64ToBytes(row['value']) });
  }
  return entries;
}

/** A page shorter than the requested `limit` is the last page — no cursor. */
function resolveNextScanCursor(
  entries: readonly StorageScanEntry[],
  limit: number | undefined,
): string | undefined {
  const lastEntry = entries.at(-1);
  const pageWasFull = limit !== undefined && entries.length >= limit;
  return pageWasFull && lastEntry ? lastEntry.key : undefined;
}

export async function storageScan(
  connection: StorageConnection,
  options: StorageScanOptions,
): Promise<StorageScanPage> {
  const params = buildScanQueryParams(options);
  const response = await fetch(`${storageUrl(connection, '')}?${params.toString()}`, {
    method: 'GET',
    headers: storageHeaders(connection),
  });

  if (!response.ok) return throwStorageError(response);

  const entries = parseNdjsonScanEntries(await response.text());
  return { entries, nextCursor: resolveNextScanCursor(entries, options.limit) };
}

/** `POST /v1/storage/-/batch`. */
export async function storageBatch(
  connection: StorageConnection,
  operations: readonly StorageBatchOperationInput[],
): Promise<void> {
  const response = await fetch(storageUrl(connection, '/-/batch'), {
    method: 'POST',
    headers: storageHeaders(connection, 'application/json'),
    body: JSON.stringify({ operations: operations.map(encodeBatchOperation) }),
  });

  if (!response.ok) await throwStorageError(response);
}

/** `POST /v1/storage/-/conditional-batch`. Throws `HttpClientError` with `faultCode: 'NotImplemented'` when the backend reports `capabilities().conditionalBatch: false`. */
export async function storageConditionalBatch(
  connection: StorageConnection,
  conditions: readonly StorageConditionInput[],
  operations: readonly StorageBatchOperationInput[],
): Promise<StorageConditionalBatchResult> {
  const response = await fetch(storageUrl(connection, '/-/conditional-batch'), {
    method: 'POST',
    headers: storageHeaders(connection, 'application/json'),
    body: JSON.stringify({
      conditions: conditions.map(encodeCondition),
      operations: operations.map(encodeBatchOperation),
    }),
  });

  if (!response.ok) return throwStorageError(response);
  const result: unknown = await response.json();
  if (!isRecord(result) || typeof result['applied'] !== 'boolean') {
    throw new Error('Malformed conditional storage batch response');
  }
  return { applied: result['applied'] };
}

/**
 * Probes whether the connected backend supports `conditionalBatch` by
 * issuing a genuinely no-op conditional batch: empty conditions AND empty
 * operations. The operation checks `storage.capabilities().conditionalBatch`
 * before touching any key (`storageConditionalBatchOperation.invoke`), and
 * `storageConditionalBatch(storage, [], [])` vacuously satisfies every
 * (zero) condition and applies zero writes even when the check passes — so
 * this call is side-effect-free either way. This mirrors the
 * probe-and-infer pattern `src/lib/scopes.svelte.ts` already uses for
 * principal resolution, necessary because weft has no operation exposing
 * `Storage.capabilities()` over the wire at all. Filed upstream:
 * https://github.com/stevekinney/weft/issues/727.
 *
 * Detects the "not supported" outcome by HTTP status (501, `NotImplemented`'s
 * documented REST status — `FAULT_CODE_TO_HTTP_STATUS` in
 * `weft/src/server/operation-fault.ts`), not `HttpClientError.faultCode`:
 * `shapeRestFault` never puts a `code` field on the wire (see
 * `parseStorageErrorBody`'s doc comment above), so `faultCode` is always
 * `undefined` for a storage fault in practice.
 */
export async function probeConditionalBatchSupported(
  connection: StorageConnection,
): Promise<boolean> {
  try {
    await storageConditionalBatch(connection, [], []);
    return true;
  } catch (error) {
    if (error instanceof HttpClientError && error.status === 501) return false;
    throw error;
  }
}
