import type { PlaceholderCandidate, PlaceholderSchemaType } from '@lostgradient/markdown';
import type { Mark } from 'prosemirror-model';
import type { EditorState, Transaction } from 'prosemirror-state';
import { PluginKey } from 'prosemirror-state';

import {
  detectTokenQuery,
  filterAndSortCandidates,
  mergeCandidates,
  type DetectedTokenQuery,
} from './template-completion-query.js';
import type { PlaceholderCompletionSource } from './template-placeholder-configuration.js';

export interface CompletionState {
  /** Whether the caret is in a token that completion is tracking. */
  active: boolean;
  /** Set by an Escape or Tab dismissal; cleared by the next document change. */
  dismissed: boolean;
  query: string;
  /** Every match, sorted; the popup shows up to eight rows at a time. */
  suggestions: PlaceholderCandidate[];
  /** Async lookup results received for `query`; discarded when the query or configuration changes. */
  asyncCandidates: PlaceholderCandidate[];
  activeIndex: number;
  tokenFrom: number;
  tokenTo: number;
  cursorPos: number;
  marks: readonly Mark[];
}

export const INACTIVE_STATE: CompletionState = Object.freeze<CompletionState>({
  active: false,
  dismissed: false,
  query: '',
  suggestions: [],
  asyncCandidates: [],
  activeIndex: 0,
  tokenFrom: 0,
  tokenTo: 0,
  cursorPos: 0,
  marks: [],
});

const DISMISSED_STATE: CompletionState = Object.freeze<CompletionState>({
  ...INACTIVE_STATE,
  dismissed: true,
});

export type CompletionMeta =
  | { type: 'close' }
  | { type: 'dismiss' }
  | { type: 'navigate'; index: number }
  | {
      type: 'asyncResults';
      query: string;
      candidates: PlaceholderCandidate[];
      /** The completion configuration the lookup ran under; results for any other are stale. */
      source: PlaceholderCompletionSource;
    };

export const templateCompletionPluginKey = new PluginKey<CompletionState>('template-completion');

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isCompletionMeta(value: unknown): value is CompletionMeta {
  if (!isRecord(value)) return false;
  if (value['type'] === 'close' || value['type'] === 'dismiss') return true;
  if (value['type'] === 'navigate') {
    return (
      typeof value['index'] === 'number' &&
      Number.isSafeInteger(value['index']) &&
      value['index'] >= 0
    );
  }
  return (
    value['type'] === 'asyncResults' &&
    typeof value['query'] === 'string' &&
    isRecord(value['source']) &&
    isCandidateArray(value['candidates'])
  );
}

const SCHEMA_TYPES: ReadonlySet<unknown> = new Set<PlaceholderSchemaType>([
  'string',
  'number',
  'integer',
  'boolean',
  'null',
  'object',
  'array',
]);

function isSchemaTypeList(value: unknown): value is readonly PlaceholderSchemaType[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    new Set(value).size === value.length &&
    value.every((type) => SCHEMA_TYPES.has(type))
  );
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string';
}

function isCandidate(value: unknown): value is PlaceholderCandidate {
  return (
    isRecord(value) &&
    typeof value['path'] === 'string' &&
    (value['types'] === undefined || isSchemaTypeList(value['types'])) &&
    isOptionalString(value['title']) &&
    isOptionalString(value['description'])
  );
}

function isCandidateArray(value: unknown): value is PlaceholderCandidate[] {
  return Array.isArray(value) && value.every(isCandidate);
}

function applyMeta(
  meta: CompletionMeta,
  previousState: CompletionState,
  configuration: PlaceholderCompletionSource,
): CompletionState | undefined {
  if (meta.type === 'close') return INACTIVE_STATE;
  if (meta.type === 'dismiss') return DISMISSED_STATE;
  if (meta.type === 'navigate') {
    return meta.index < previousState.suggestions.length
      ? { ...previousState, activeIndex: meta.index }
      : undefined;
  }

  // Results for another configuration, a query the user has since changed, or a
  // closed popup are stale.
  if (
    meta.source !== configuration ||
    !previousState.active ||
    meta.query !== previousState.query
  ) {
    return previousState;
  }
  const suggestions = filterAndSortCandidates(
    mergeCandidates(configuration.candidates, meta.candidates),
    previousState.query,
  );
  return {
    ...previousState,
    suggestions,
    asyncCandidates: meta.candidates,
    activeIndex: Math.min(previousState.activeIndex, Math.max(suggestions.length - 1, 0)),
  };
}

function buildDetectedState(
  previousState: CompletionState,
  configuration: PlaceholderCompletionSource,
  detected: DetectedTokenQuery,
  configurationChanged: boolean,
): CompletionState {
  const { query } = detected;
  if (query.length < configuration.minimumQueryLength) return INACTIVE_STATE;

  const sameQuery = previousState.active && previousState.query === query;
  // Async results belong to one query under one configuration.
  const asyncCandidates = sameQuery && !configurationChanged ? previousState.asyncCandidates : [];
  const suggestions = filterAndSortCandidates(
    mergeCandidates(configuration.candidates, asyncCandidates),
    query,
  );
  const activeIndex = sameQuery
    ? Math.min(previousState.activeIndex, Math.max(suggestions.length - 1, 0))
    : 0;
  return { active: true, dismissed: false, suggestions, asyncCandidates, activeIndex, ...detected };
}

/** What changed in one editing step, independent of the editing surface. */
export interface CompletionStep {
  /** Completion metadata the step carries, if any. */
  readonly meta?: CompletionMeta | undefined;
  /** Whether the step changed the text. */
  readonly documentChanged: boolean;
  /** Whether the step installed a new placeholder configuration. */
  readonly configurationChanged?: boolean;
  /** Set while the key that dismissed completion is still making its own changes. */
  readonly keepDismissal?: boolean;
  /** The in-progress token after the step, read only when needed. */
  readonly detect: () => DetectedTokenQuery | null;
}

/**
 * Compute the next completion state for any editing surface.
 *
 * A dismissal persists through selection-only and configuration-only steps
 * and ends with the next text change, except while `keepDismissal` is set
 * for changes made by the dismissing key. With no completion configured the
 * state is always inactive.
 */
export function advanceCompletionState(
  previousState: CompletionState,
  configuration: PlaceholderCompletionSource | undefined,
  step: CompletionStep,
): CompletionState {
  if (!configuration) return INACTIVE_STATE;

  if (step.meta) {
    const metaState = applyMeta(step.meta, previousState, configuration);
    if (metaState) return metaState;
  }
  // A dismissal lasts until the next editing action. Document changes made by
  // the dismissing key itself (Tab indenting a list item) do not end it.
  if (previousState.dismissed && (!step.documentChanged || step.keepDismissal === true)) {
    return previousState;
  }

  const detected = step.detect();
  return detected
    ? buildDetectedState(previousState, configuration, detected, step.configurationChanged === true)
    : INACTIVE_STATE;
}

/**
 * Compute the next completion state for a ProseMirror transaction; see
 * {@link advanceCompletionState}.
 */
export function computeCompletionState(
  previousState: CompletionState,
  transaction: Transaction,
  editorState: EditorState,
  configuration: PlaceholderCompletionSource | undefined,
  configurationChanged = false,
  keepDismissal = false,
): CompletionState {
  const rawMeta: unknown = transaction.getMeta(templateCompletionPluginKey);
  return advanceCompletionState(previousState, configuration, {
    meta: isCompletionMeta(rawMeta) ? rawMeta : undefined,
    documentChanged: transaction.docChanged,
    configurationChanged,
    keepDismissal,
    detect: () => detectTokenQuery(editorState),
  });
}
