/**
 * Pure view-model mapping for per-`(name, revision)` dynamic-source load
 * diagnostics (WFT-116): turns `weft.catalog.diagnostics`' output into
 * render-ready rows. Framework-free and unit-testable without a DOM,
 * mirroring `registry-view.ts`/`workflow-revisions-view.ts`.
 *
 * ## What Weft actually exposes, and what it doesn't
 *
 * `weft.catalog.diagnostics` (`system:read`) answers for ONE `(name,
 * revision)` key. Its `source` block is present only when `name` has ever
 * been `engine.registerSource()`-registered in the serving process — for a
 * purely eager `engine.register()` workflow it is absent, which this module
 * reports as an explicit {@link SourceLoadSummary} of kind `'not-dynamic'`
 * rather than an empty/ambiguous render.
 *
 * There is deliberately no local re-derivation of any of it: `state`,
 * `loadDurationMs`, `waiterCount`, and `lastFailureCategory` are read
 * verbatim off the wire. The console never imports Weft's source-runtime
 * internals (`core/engine/source-runtime-state.ts` is server-only), so the
 * two closed unions below are hand-declared mirrors of
 * `SourceLoadState`/`FailureCategory` — the same browser-bundle constraint
 * `compatibility-verdict.ts`' `KNOWN_COMPATIBILITY_REASONS` documents.
 *
 * ## Enumeration is separate from diagnostics
 *
 * `weft.catalog.sources.list` enumerates `registerSource()`-registered names
 * and revisions, while `weft.catalog.diagnostics` still answers for one exact
 * key. `dynamic-source-panel.svelte` combines them: the source list fills a
 * key, and this module renders only that key's diagnostics.
 */
import { formatDuration } from '../../lib/format/index.ts';

/** Mirrors `SourceLoadState` (`@lostgradient/weft`, server-only) — the five closed-union literals, in lifecycle order. */
export const KNOWN_SOURCE_LOAD_STATES = [
  'idle',
  'loading',
  'ready',
  'failed',
  'cancelled',
] as const;

export type KnownSourceLoadState = (typeof KNOWN_SOURCE_LOAD_STATES)[number];

/** Mirrors `FailureCategory` (`@lostgradient/weft`) — the five bounded categories a load failure is classified into. */
export const KNOWN_FAILURE_CATEGORIES = [
  'application',
  'timeout',
  'cancellation',
  'resource',
  'system',
] as const;

export type KnownFailureCategory = (typeof KNOWN_FAILURE_CATEGORIES)[number];

/** Structural mirror of `WorkflowRevisionDiagnostics['source']` (`@lostgradient/weft`). */
export interface SourceLoadDiagnosticsLike {
  readonly kind: string;
  readonly requestedRevision: string;
  readonly state: string;
  readonly loadDurationMs?: number;
  readonly lastFailureCategory?: string;
  readonly waiterCount: number;
}

/** Structural mirror of `WorkflowRevisionDiagnostics` (`@lostgradient/weft`) — only the fields this console reads. */
export interface CatalogDiagnosticsLike {
  readonly name: string;
  readonly revision: string;
  readonly installed: boolean;
  readonly active: boolean;
  readonly source?: SourceLoadDiagnosticsLike;
}

function isSourceLoadDiagnosticsLike(value: unknown): value is SourceLoadDiagnosticsLike {
  if (typeof value !== 'object' || value === null) return false;
  const record: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) record[key] = entry;
  if (!hasSourceLoadDiagnosticsFields(record)) return false;
  // Both optional fields are present-or-absent on the wire (the server
  // spreads them conditionally); a present-but-wrong-typed one is malformed
  // data, not an absent field, so it fails the guard rather than being
  // silently dropped.
  if (record['loadDurationMs'] !== undefined && !isNumber(record['loadDurationMs'])) {
    return false;
  }
  return (
    record['lastFailureCategory'] === undefined || typeof record['lastFailureCategory'] === 'string'
  );
}

function hasSourceLoadDiagnosticsFields(record: Record<string, unknown>): boolean {
  return (
    isString(record['kind']) &&
    isString(record['requestedRevision']) &&
    isString(record['state']) &&
    isNumber(record['waiterCount'])
  );
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number';
}

/**
 * Runtime type guard for one `weft.catalog.diagnostics` response. The
 * generated client types this operation's output as `unknown` (its zod
 * schema is `z.unknown()`, same as every other catalog operation), so every
 * response is guarded rather than cast.
 */
export function isCatalogDiagnosticsLike(value: unknown): value is CatalogDiagnosticsLike {
  if (typeof value !== 'object' || value === null) return false;
  const record: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) record[key] = entry;
  if (
    typeof record['name'] !== 'string' ||
    typeof record['revision'] !== 'string' ||
    typeof record['installed'] !== 'boolean' ||
    typeof record['active'] !== 'boolean'
  ) {
    return false;
  }
  return record['source'] === undefined || isSourceLoadDiagnosticsLike(record['source']);
}

/** Sentence-case operator copy for each known load state (plan §10.10 copy voice). */
const SOURCE_LOAD_STATE_LABELS: Readonly<Record<KnownSourceLoadState, string>> = {
  idle: 'Idle',
  loading: 'Loading',
  ready: 'Ready',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

/** What each load state means for the operator looking at it right now. */
const SOURCE_LOAD_STATE_DESCRIPTIONS: Readonly<Record<KnownSourceLoadState, string>> = {
  // NOT "this revision is registered": `buildSourceDiagnostics()` keys the
  // whole `source` block on the NAME (`internals.sources.byName`) and falls
  // back to `idle` for a revision it has no diagnostics entry for — so a typo
  // or an entirely unregistered revision of a registered name reports `idle`
  // exactly like a real registered-but-never-loaded one. Preload would fault
  // NotFound for it. This copy therefore reports only what `idle` actually
  // means (no load recorded) and names the ambiguity rather than resolving it
  // in the operator's favour.
  idle: 'No load has been recorded for this revision. The workflow name has a registered source; this exact revision may not, in which case preloading it is refused as not found.',
  loading: 'A load is in flight in the serving engine right now.',
  // Deliberately past tense, and deliberately silent about the catalog:
  // `removeWorkflowRevision()` does not reset this process-local diagnostics
  // entry, so a revision loaded successfully and later removed still reports
  // `ready` alongside `installed: false` in the SAME response. The authoritative
  // current answer is that `installed` flag, which the meta grid now carries.
  ready: 'The last load completed successfully.',
  failed: 'The last load attempt failed. See the failure category below.',
  // NOT "the load stopped". `endSourceWaiterAndCheckCancellation()` flips this
  // state when the LAST waiting caller releases (an abort, or engine disposal);
  // `source-resolution.ts` deliberately leaves the shared load running, and it
  // can still finish and install the revision while the state reads
  // `cancelled`. Saying the attempt was cancelled would tell an operator work
  // stopped when it may be executing right now — or may already have committed.
  cancelled:
    'Every caller waiting on this load went away. The load itself may still be running, and may still install this revision.',
};

/**
 * Operator copy for each bounded failure category, restated from Weft's OWN
 * definitions (`core/types/identity.ts`) and nothing more.
 *
 * An earlier version of this table invented load-specific meanings — reading
 * `resource` as "could not reach or read its source", for instance. That is
 * wrong twice over: `resource` canonically means a quota/memory/disk/capacity
 * limit, and an unreachable artifact is not classified that way at all.
 * `classifyErrorAsFailureCategory` recognizes only timeout, cancellation, and
 * resource error NAMES; `source-diagnostics.ts` passes
 * `defaultErrorCategory: 'application'`, so every ordinary loader, validation,
 * or catalog-install error — an ENOENT included — lands in `application`.
 *
 * That matters more here than elsewhere precisely because the raw error is
 * deliberately masked on the wire: this category is all the operator gets, so
 * inventing detail around it is inventing detail they cannot check.
 */
const FAILURE_CATEGORY_LABELS: Readonly<Record<KnownFailureCategory, string>> = {
  application:
    'Application code threw. This is also the default classification for an ordinary load error, so it does not by itself mean the module misbehaved.',
  timeout: 'Execution exceeded a configured deadline.',
  cancellation: 'Cancellation or abort ended execution.',
  resource: 'A quota, memory, disk, or capacity limit was exceeded.',
  system: 'An engine, storage, or worker infrastructure fault.',
};

function isKnownSourceLoadState(value: string): value is KnownSourceLoadState {
  return (KNOWN_SOURCE_LOAD_STATES as readonly string[]).includes(value);
}

function isKnownFailureCategory(value: string): value is KnownFailureCategory {
  return (KNOWN_FAILURE_CATEGORIES as readonly string[]).includes(value);
}

/**
 * Display label for one load state. An unrecognized value (a future state
 * this console build predates, or malformed wire data) renders honestly as
 * the raw value rather than a fabricated label — this module never guesses
 * what an unknown state means.
 */
export function sourceLoadStateLabel(state: string): string {
  return isKnownSourceLoadState(state) ? SOURCE_LOAD_STATE_LABELS[state] : state;
}

/** Explanatory copy for one load state, or `undefined` for an unrecognized one (see {@link sourceLoadStateLabel}). */
export function sourceLoadStateDescription(state: string): string | undefined {
  return isKnownSourceLoadState(state) ? SOURCE_LOAD_STATE_DESCRIPTIONS[state] : undefined;
}

/** Explanatory copy for one bounded failure category, or `undefined` for an unrecognized one. */
export function failureCategoryDescription(category: string): string | undefined {
  return isKnownFailureCategory(category) ? FAILURE_CATEGORY_LABELS[category] : undefined;
}

/**
 * Whether a state warrants a non-color status treatment of "attention" —
 * paired with an icon and text in the component, never color alone.
 */
export type SourceLoadTone = 'positive' | 'attention' | 'neutral' | 'progress';

const SOURCE_LOAD_STATE_TONES: Readonly<Record<KnownSourceLoadState, SourceLoadTone>> = {
  idle: 'neutral',
  loading: 'progress',
  ready: 'positive',
  failed: 'attention',
  cancelled: 'attention',
};

export function sourceLoadStateTone(state: string): SourceLoadTone {
  return isKnownSourceLoadState(state) ? SOURCE_LOAD_STATE_TONES[state] : 'neutral';
}

/** One `<dt>`/`<dd>` pair in a diagnostics meta grid. Mirrors `workflow-revisions-view.ts`'s `RowMetaItem`. */
export interface SourceMetaItem {
  readonly term: string;
  readonly value: string;
  readonly title: string | undefined;
  readonly mono: boolean;
}

/**
 * A resolved diagnostics response, reduced to exactly what the component
 * renders: either a dynamic source with its live load state, or an explicit
 * statement that this key has no dynamic source at all.
 */
export type SourceLoadSummary =
  | {
      readonly kind: 'dynamic';
      readonly sourceKind: string;
      /** `weft.catalog.diagnostics`' own `installed` flag — the authoritative answer for "is this revision in the catalog right now", which `state` is not. */
      readonly installed: boolean;
      readonly requestedRevision: string;
      readonly state: string;
      readonly stateLabel: string;
      readonly stateDescription: string | undefined;
      readonly tone: SourceLoadTone;
      readonly waiterCount: number;
      readonly lastFailureCategory: string | undefined;
      readonly lastFailureDescription: string | undefined;
      readonly meta: readonly SourceMetaItem[];
    }
  | {
      readonly kind: 'not-dynamic';
      /** Whether the queried revision is nonetheless durably installed — `weft.catalog.diagnostics`' own `installed` flag, verbatim. */
      readonly installed: boolean;
      readonly message: string;
    };

/**
 * Load duration copy. `undefined` is NOT "0 ms": the server omits the field
 * entirely until a load has actually completed, so an absent value renders as
 * explicit text rather than a misleading zero.
 *
 * The absent case splits three ways, because one phrase cannot honestly cover
 * them. `cancelled` in particular is NOT "not loaded yet": the engine's
 * cancellation transition (`source-diagnostics.ts`) sets `state` alone and
 * never records a duration, so a load that genuinely started and was then
 * cancelled arrives here with no duration — and "Not loaded yet" next to
 * "Load state: Cancelled" would contradict itself.
 */
function loadDurationValue(state: string, loadDurationMs: number | undefined): string {
  if (loadDurationMs !== undefined) return formatDuration(loadDurationMs);
  if (state === 'loading') return 'In flight';
  // `cancelled` records no duration but is NOT "never started" — see the state
  // description for why the underlying load may still be running.
  return state === 'cancelled' ? 'Not recorded' : 'Not loaded yet';
}

/**
 * Waiter-count copy. `waiterCount` is the number of callers currently
 * awaiting the single-flight load for this exact key — it is meaningful at
 * zero (nobody is blocked), so it always renders as a number, never as a
 * dash.
 */
function waiterCountValue(waiterCount: number): string {
  return waiterCount === 1 ? '1 caller waiting' : `${String(waiterCount)} callers waiting`;
}

/**
 * Reduce one guarded `weft.catalog.diagnostics` response to its render-ready
 * {@link SourceLoadSummary}.
 */
export function summarizeSourceLoad(diagnostics: CatalogDiagnosticsLike): SourceLoadSummary {
  const source = diagnostics.source;
  if (source === undefined) {
    return {
      kind: 'not-dynamic',
      installed: diagnostics.installed,
      // Deliberately says nothing about HOW this revision got into the
      // catalog. `weft.catalog.diagnostics` carries no field distinguishing
      // an `engine.register()` revision from one put there by
      // `weft.workflows.revisions.install` — the seeded
      // `order-processing-candidate-2` fixture is exactly the second case,
      // installed with no in-process handler behind it — so claiming
      // "registered eagerly" here would be a guess dressed as a fact. The
      // absence of `source` supports one statement and no more: this
      // workflow name has no dynamic source registered on the serving
      // engine.
      message: diagnostics.installed
        ? 'No dynamic source is registered for this workflow. This revision is installed in the catalog.'
        : 'No dynamic source is registered for this workflow, and this revision is not installed.',
    };
  }

  return {
    kind: 'dynamic',
    sourceKind: source.kind,
    installed: diagnostics.installed,
    requestedRevision: source.requestedRevision,
    state: source.state,
    stateLabel: sourceLoadStateLabel(source.state),
    stateDescription: sourceLoadStateDescription(source.state),
    tone: sourceLoadStateTone(source.state),
    waiterCount: source.waiterCount,
    lastFailureCategory: source.lastFailureCategory,
    lastFailureDescription:
      source.lastFailureCategory === undefined
        ? undefined
        : failureCategoryDescription(source.lastFailureCategory),
    meta: [
      { term: 'Source kind', value: source.kind, title: undefined, mono: true },
      {
        term: 'Requested revision',
        value: source.requestedRevision,
        title: source.requestedRevision,
        mono: true,
      },
      {
        term: 'Load duration',
        value: loadDurationValue(source.state, source.loadDurationMs),
        title: undefined,
        mono: false,
      },
      {
        term: 'Waiters',
        value: waiterCountValue(source.waiterCount),
        title: undefined,
        mono: false,
      },
      {
        term: 'Last failure',
        value: source.lastFailureCategory ?? 'None recorded',
        title: undefined,
        mono: false,
      },
      {
        // Separate from `state` on purpose: a `ready` revision removed from the
        // catalog afterwards still reports `ready`, so this is the only field
        // that answers "is it there now".
        term: 'In catalog',
        value: diagnostics.installed ? 'Installed' : 'Not installed',
        title: undefined,
        mono: false,
      },
    ],
  };
}

/** How often a summary's diagnostics should be re-fetched. */
export type SourceLoadPollInterval = number;

/** A load in flight moves quickly: state, waiter count, and eventually duration all change without any console action. */
export const ACTIVE_SOURCE_POLL_MS = 2_000;

/**
 * Everything that is not a load in flight. Slow enough to be background noise,
 * but never off.
 *
 * Off was wrong for BOTH settled states and the no-source state, for the same
 * underlying reason: nothing that changes them invalidates this console's
 * cache. A settled source moves when another operator preloads or a workflow
 * start resolves it. A `not-dynamic` answer stops being true the moment the
 * host calls `engine.registerSource()` — which is synchronous, in-memory, and
 * writes nothing to the catalog, so there is no write for this console to
 * observe. A lookup that happened to run first would otherwise read "no dynamic
 * source" for the rest of the session while the engine loaded it.
 */
export const SETTLED_SOURCE_POLL_MS = 30_000;

/**
 * The poll interval for one summary. Always a number: see
 * {@link SETTLED_SOURCE_POLL_MS} for why no state is safe to stop watching.
 */
export function sourceLoadPollInterval(summary: SourceLoadSummary): SourceLoadPollInterval {
  return summary.kind === 'dynamic' && summary.state === 'loading'
    ? ACTIVE_SOURCE_POLL_MS
    : SETTLED_SOURCE_POLL_MS;
}
