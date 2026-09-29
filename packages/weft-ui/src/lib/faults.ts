/**
 * Fault → UI treatment mapping (plan §10.4, T1.5). Frozen after the Phase 1
 * Foundation gate — see PROJECT-BRIEF "Shared contracts".
 *
 * Weft's wire `FaultCode` (13 values, `@lostgradient/weft`) is more granular
 * than the console's UI treatment vocabulary. The plan's "one FaultDisplay
 * treatment, six codes" (§10.4) is that coarser bucket, derived here from
 * `FaultCode` and its documented REST HTTP status
 * (`weft/src/server/operation-fault.ts` `FAULT_CODE_TO_HTTP_STATUS`) rather
 * than invented independently, so the mapping cannot silently drift from the
 * wire contract.
 *
 * ## What `HttpClientError` does and doesn't carry (verified against the
 * installed `@lostgradient/weft@0.12.0`, `dist/client/http-request.d.ts`)
 *
 * `HttpClientError` exposes `status`, `message`, an optional coarse
 * `faultCode` (`FaultCode`), an optional fine-grained `weftCode`
 * (`WeftErrorCode`, e.g. `IdempotencyKeyPurgedError`), and — as of
 * `@lostgradient/weft@0.12.0` — an optional `data?: Readonly<Record<string,
 * unknown>>` carrying the wire fault's typed payload (field-level `issues`,
 * the conflicting `resource`/`identifier`, …). That closed the
 * JSON-RPC-over-HTTP half of https://github.com/stevekinney/weft/issues/711
 * (fixed upstream #721) — confirmed live: `POST /jsonrpc` with invalid
 * params now returns `error.data.issues` on the wire and `HttpClientError`
 * surfaces it. **REST did not move**: every production REST binding still
 * uses `shapeRestFault`, which emits a flat `{ error: string }` body with no
 * `data` for any fault code (confirmed live: the same invalid input over
 * REST returns only `{"error":"Missing required field: type"}`) — tracked
 * separately upstream as #720. This module's `invalid.fieldErrors` stays
 * `[]` regardless: `classifyFault` doesn't yet read the now-real
 * `error.data` for JSON-RPC-routed calls, so wiring it up (JSON-RPC-only,
 * still `[]` for REST) is a genuine, scoped follow-up now that the wire
 * data exists — not implemented here to keep this change to the import-path
 * fix. `conflict`/`not-found` still cannot attach a resource link beyond
 * what `message` says in prose, for the same REST-side reason.
 *
 * `weftCode` (and therefore `isSpentIdempotencyKey` below) is REST-only: the
 * JSON-RPC fault envelope writes its own coarse `weftCode: fault.code` (e.g.
 * `'Conflict'`) into `data` LAST (`fault-to-json-rpc.ts`), which overwrites
 * any fine-grained `weftCode` (e.g. `'IdempotencyKeyPurgedError'`) the
 * fault's own per-code payload carried — and `httpClientCatalogTransport`
 * never forwards a `weftCode` onto the thrown error regardless. Deliberate
 * upstream design, not a bug to fix here: don't "fix" the JSON-RPC path to
 * try to recover it.
 */
// `isWeftFault` (and the rest of the `isWeftError*` family) is exported from
// `@lostgradient/weft` as of `@lostgradient/weft@0.12.0`
// (https://github.com/stevekinney/weft/issues/722, fixed upstream #733) —
// importing it from there, rather than the package root (whose barrel also
// re-exports server-only code reaching `node:crypto`), is what actually
// keeps this module's dependency graph browser-only end to end.
import {
  HttpClientError,
  isWeftFault,
  type FaultCode,
  type WeftErrorCode,
} from '@lostgradient/weft';

/** The six `FaultDisplay` UI treatment buckets (plan §10.4). */
export type FaultTreatmentKind =
  'not-found' | 'conflict' | 'invalid' | 'unauthorized' | 'not-supported' | 'internal';

/**
 * A single field-level validation error. Currently unreachable in practice —
 * see the module doc's `HttpClientError` gap — kept as a real shape (rather
 * than dropped) so consuming UI is already built for the day the client
 * surfaces it.
 */
export interface FaultFieldError {
  readonly path: string;
  readonly message: string;
}

/**
 * A classified fault, ready for presentation. One variant per
 * `FaultTreatmentKind`, each carrying only the detail that treatment can
 * actually act on (plan §10.4's per-code list).
 */
export type FaultTreatment =
  | { readonly kind: 'not-found'; readonly message: string }
  | {
      readonly kind: 'conflict';
      readonly message: string;
      /**
       * `true` when the conflict is a spent idempotency key
       * (`IdempotencyKeyPurgedError` — the key maps to a purged run; see
       * `weft/src/core/engine/lifecycle/start-or-signal.ts`). REST-only —
       * see the module doc.
       */
      readonly isSpentIdempotencyKey: boolean;
    }
  | {
      readonly kind: 'invalid';
      readonly message: string;
      /** Always `[]` today — see the module doc. */
      readonly fieldErrors: readonly FaultFieldError[];
    }
  | {
      readonly kind: 'unauthorized';
      readonly message: string;
      /** `401` → no credential was accepted, re-authenticate. `403` → a valid credential lacks the required scope. */
      readonly mode: 'reauth' | 'forbidden';
    }
  | { readonly kind: 'not-supported'; readonly message: string }
  | {
      readonly kind: 'internal';
      readonly message: string;
      /**
       * `true` when the fault crossed REST through the canonical
       * `shapeRestFault` masking path (`weft/src/server/operations/operation-helpers.ts`):
       * `EngineFailure` collapses to `{ error: "Internal server error" }` with
       * no `faultCode` on the wire, so this is the only signal the client has
       * that real detail exists server-side but wasn't sent. JSON-RPC and the
       * unmasked REST default (`faultToHttpResponse`) both carry a real
       * `faultCode` here and set this `false`.
       */
      readonly maskedByRest: boolean;
      /** Show a "try via JSON-RPC" hint — true exactly when `maskedByRest` is, since JSON-RPC is the transport that would carry the un-masked detail. */
      readonly tryViaJsonRpc: boolean;
      /**
       * Correlation id for cross-referencing server logs. Always `undefined`
       * today — weft has no request/correlation-id concept yet (grepped
       * `weft/src/server`; none exists). Never fabricate one here: a
       * client-made id would misleadingly imply server-side correlation.
       * Tracked in the same upstream issue as the `data` gap above.
       */
      readonly requestId?: string;
    };

/**
 * Every `FaultCode` mapped to its treatment kind. `satisfies` over
 * `Record<FaultCode, FaultTreatmentKind>` forces a compile error if
 * `@lostgradient/weft` adds a new `FaultCode` this map doesn't account for.
 */
const FAULT_CODE_TREATMENT_KIND = {
  NotFound: 'not-found',
  MethodNotFound: 'not-found',
  Conflict: 'conflict',
  Unprocessable: 'invalid',
  InvalidParams: 'invalid',
  PayloadTooLarge: 'invalid',
  Unauthorized: 'unauthorized',
  Forbidden: 'unauthorized',
  NotImplemented: 'not-supported',
  UnsupportedTransport: 'not-supported',
  // `Timeout`'s REST status (408) is nominally a 4xx, but a timeout is
  // transient by nature (unlike the other 4xx codes, retrying with the same
  // input can succeed) — bucketed with `internal` deliberately so query.ts's
  // retry policy treats it as retryable. See query.ts `shouldRetryQuery`.
  Timeout: 'internal',
  SubscriptionOverflow: 'internal',
  EngineFailure: 'internal',
} as const satisfies Record<FaultCode, FaultTreatmentKind>;

/** HTTP status → treatment fallback for responses with no `faultCode` (e.g. a REST-masked `EngineFailure`, or a plain network/proxy error that never carried a Weft fault at all). */
function treatmentKindForStatus(status: number): FaultTreatmentKind {
  if (status === 404) return 'not-found';
  if (status === 409) return 'conflict';
  if (status === 400 || status === 413 || status === 422) return 'invalid';
  if (status === 401 || status === 403) return 'unauthorized';
  if (status === 501) return 'not-supported';
  return 'internal';
}

function treatmentKindForError(error: HttpClientError): FaultTreatmentKind {
  if (error.faultCode) return FAULT_CODE_TREATMENT_KIND[error.faultCode];
  return treatmentKindForStatus(error.status);
}

/** `401` (no credential accepted) vs `403` (credential accepted, scope denied) — prefers the coarse `faultCode` when present, falls back to the raw status otherwise. */
function unauthorizedMode(error: HttpClientError): 'reauth' | 'forbidden' {
  if (error.faultCode === 'Forbidden') return 'forbidden';
  if (error.faultCode === 'Unauthorized') return 'reauth';
  return error.status === 403 ? 'forbidden' : 'reauth';
}

const SPENT_IDEMPOTENCY_KEY_CODE: WeftErrorCode = 'IdempotencyKeyPurgedError';

/**
 * Classifies an error caught from a `client.*`/`client.operations[...]` call
 * into a `FaultTreatment`. Returns `null` for errors that never crossed the
 * Weft fault wire (a network failure, a programming error thrown during
 * render) — callers fall back to `UNKNOWN_FAULT_TREATMENT` (or use
 * `faultTreatment()`, which does that for them) rather than one of the six
 * documented treatments for those.
 */
export function classifyFault(error: unknown): FaultTreatment | null {
  if (!(error instanceof HttpClientError)) return null;

  const kind = treatmentKindForError(error);
  switch (kind) {
    case 'not-found':
      return { kind, message: error.message };
    case 'conflict':
      return {
        kind,
        message: error.message,
        isSpentIdempotencyKey: isWeftFault(error, SPENT_IDEMPOTENCY_KEY_CODE),
      };
    case 'invalid':
      return { kind, message: error.message, fieldErrors: [] };
    case 'unauthorized':
      return { kind, message: error.message, mode: unauthorizedMode(error) };
    case 'not-supported':
      return { kind, message: error.message };
    case 'internal': {
      // See `FaultTreatment.internal.maskedByRest` doc: no `faultCode` at
      // all is the only signal available that detail was masked/dropped.
      const maskedByRest = error.faultCode === undefined;
      return { kind, message: error.message, maskedByRest, tryViaJsonRpc: maskedByRest };
    }
    default:
      return null;
  }
}

/** Generic fallback for errors `classifyFault` can't attribute to a wire fault (offline, a thrown bug reaching a boundary, …). */
export const UNKNOWN_FAULT_TREATMENT: FaultTreatment = {
  kind: 'internal',
  message: 'Something went wrong. Check your connection and try again.',
  maskedByRest: false,
  tryViaJsonRpc: false,
};

/** `classifyFault(error) ?? UNKNOWN_FAULT_TREATMENT` — the treatment every caller should present, never `null`. */
export function faultTreatment(error: unknown): FaultTreatment {
  return classifyFault(error) ?? UNKNOWN_FAULT_TREATMENT;
}

/** Sentence-case heading for each treatment kind (plan §10.10 copy voice), shared by every surface presenting a `FaultTreatment`. */
export const FAULT_TREATMENT_TITLE: Readonly<Record<FaultTreatmentKind, string>> = {
  'not-found': 'Not found',
  conflict: 'Conflict',
  invalid: 'Invalid input',
  unauthorized: 'Not authorized',
  'not-supported': 'Not supported',
  internal: 'Something went wrong',
};
