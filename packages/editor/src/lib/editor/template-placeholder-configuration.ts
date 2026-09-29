/**
 * Resolve the editor's placeholder configuration into one immutable snapshot.
 *
 * The high-level path (`definitions`) and the low-level path (`completion`,
 * `decoration`) are mutually exclusive. Resolution decides which one is
 * active, normalizes definitions once per object identity, and produces the
 * configuration diagnostics. Completion, decoration and token validation all
 * read the same candidate list from the resolved snapshot.
 */

import {
  normalizePlaceholderDefinitions,
  sortPlaceholderDiagnostics,
  type NormalizedPlaceholderDefinitions,
  type PlaceholderCandidate,
  type PlaceholderCompletionConfiguration,
  type PlaceholderDecorationConfiguration,
  type PlaceholderDefinitions,
  type PlaceholderDiagnostic,
} from '@lostgradient/markdown';

/** Whether caller-supplied placeholder values exist and are a plain object. */
export type PlaceholderValuesStatus = 'absent' | 'plain' | 'invalid';

/** Placeholder configuration accepted by the editor. Values never enter it. */
export interface PlaceholderEditorConfiguration {
  /** High-level allowlist. Mutually exclusive with `completion` and `decoration`. */
  readonly definitions?: PlaceholderDefinitions | undefined;
  /** Low-level completion configuration. */
  readonly completion?: PlaceholderCompletionConfiguration | undefined;
  /** Low-level invalid-token decoration configuration. */
  readonly decoration?: PlaceholderDecorationConfiguration | undefined;
  /** Shape of the caller's placeholder values, for configuration checks only. */
  readonly valuesStatus?: PlaceholderValuesStatus | undefined;
}

/** Everything the completion plugin needs from the active configuration. */
export interface PlaceholderCompletionSource {
  readonly candidates: readonly PlaceholderCandidate[];
  readonly lookupCandidates?: PlaceholderCompletionConfiguration['lookupCandidates'];
  readonly minimumQueryLength: number;
  readonly lookupDebounceMs: number;
}

/** Everything the decoration plugin needs from the active configuration. */
export interface PlaceholderDecorationSource {
  readonly candidates: readonly PlaceholderCandidate[];
  readonly invalidClassName: string;
}

/** An immutable, resolved placeholder configuration. */
export interface ResolvedPlaceholderConfiguration {
  /** Completion, or `undefined` when completion is off. */
  readonly completion: PlaceholderCompletionSource | undefined;
  /** Invalid-token decoration, or `undefined` when decoration is off. */
  readonly decoration: PlaceholderDecorationSource | undefined;
  /** Candidates that token diagnostics validate against, or `undefined` for none. */
  readonly validationCandidates: readonly PlaceholderCandidate[] | undefined;
  /** Ordered definition and configuration diagnostics. */
  readonly issues: readonly PlaceholderDiagnostic[];
}

export const DEFAULT_INVALID_CLASS_NAME = 'template-placeholder-invalid';
const DEFAULT_MINIMUM_QUERY_LENGTH = 1;
const DEFAULT_LOOKUP_DEBOUNCE_MS = 150;

/** The resolved configuration with every placeholder feature off. */
export const UNCONFIGURED_PLACEHOLDERS: ResolvedPlaceholderConfiguration = Object.freeze({
  completion: undefined,
  decoration: undefined,
  validationCandidates: undefined,
  issues: Object.freeze<PlaceholderDiagnostic[]>([]),
});

/**
 * Normalization results keyed by definitions identity. Results are immutable,
 * so sharing them between editor instances cannot leak state between them.
 */
const normalizedDefinitions = new WeakMap<object, NormalizedPlaceholderDefinitions>();

function normalizeOnce(definitions: object): NormalizedPlaceholderDefinitions {
  const cached = normalizedDefinitions.get(definitions);
  if (cached) return cached;
  const normalized = normalizePlaceholderDefinitions(definitions);
  normalizedDefinitions.set(definitions, normalized);
  return normalized;
}

function normalizeDefinitions(definitions: unknown): NormalizedPlaceholderDefinitions {
  // Non-object definitions cannot be cached by identity; they are cheap to reject.
  return typeof definitions === 'object' && definitions !== null
    ? normalizeOnce(definitions)
    : normalizePlaceholderDefinitions(definitions);
}

/** Classify caller-supplied values without reading their contents. */
export function classifyPlaceholderValues(values: unknown): PlaceholderValuesStatus {
  if (values === undefined) return 'absent';
  if (typeof values !== 'object' || values === null || Array.isArray(values)) return 'invalid';
  const prototype: unknown = Object.getPrototypeOf(values);
  return prototype === null || prototype === Object.prototype ? 'plain' : 'invalid';
}

function configurationIssue(
  code: PlaceholderDiagnostic['code'],
  property: string,
  message: string,
): PlaceholderDiagnostic {
  return { code, message, location: { kind: 'configuration', property } };
}

function valuesIssues(
  status: PlaceholderValuesStatus,
  definitionsPresent: boolean,
): PlaceholderDiagnostic[] {
  if (status === 'absent') return [];
  const issues: PlaceholderDiagnostic[] = [];
  if (status === 'invalid') {
    issues.push(
      configurationIssue(
        'invalid_values',
        'placeholderValues',
        'Placeholder values must be a plain JSON object.',
      ),
    );
  }
  if (!definitionsPresent) {
    issues.push(
      configurationIssue(
        'invalid_definitions',
        'placeholderDefinitions',
        'Placeholder values require placeholder definitions.',
      ),
    );
  }
  return issues;
}

function resolved(
  parts: Omit<ResolvedPlaceholderConfiguration, 'issues'>,
  issues: readonly PlaceholderDiagnostic[],
): ResolvedPlaceholderConfiguration {
  if (
    parts.completion === undefined &&
    parts.decoration === undefined &&
    parts.validationCandidates === undefined &&
    issues.length === 0
  ) {
    return UNCONFIGURED_PLACEHOLDERS;
  }
  return Object.freeze({ ...parts, issues: Object.freeze(sortPlaceholderDiagnostics(issues)) });
}

function resolveDefinitions(
  definitions: PlaceholderDefinitions,
  extraIssues: readonly PlaceholderDiagnostic[],
): ResolvedPlaceholderConfiguration {
  const catalog = normalizeDefinitions(definitions);
  if (!catalog.enabled) {
    return resolved(
      { completion: undefined, decoration: undefined, validationCandidates: undefined },
      [...catalog.issues, ...extraIssues],
    );
  }
  const { candidates } = catalog;
  return resolved(
    {
      completion: Object.freeze({
        candidates,
        minimumQueryLength: 0,
        lookupDebounceMs: DEFAULT_LOOKUP_DEBOUNCE_MS,
      }),
      decoration: Object.freeze({ candidates, invalidClassName: DEFAULT_INVALID_CLASS_NAME }),
      validationCandidates: candidates,
    },
    extraIssues,
  );
}

function resolveLowLevel(
  completion: PlaceholderCompletionConfiguration | undefined,
  decoration: PlaceholderDecorationConfiguration | undefined,
  extraIssues: readonly PlaceholderDiagnostic[],
): ResolvedPlaceholderConfiguration {
  const completionSource: PlaceholderCompletionSource | undefined = completion
    ? Object.freeze({
        candidates: completion.candidates,
        ...(completion.lookupCandidates ? { lookupCandidates: completion.lookupCandidates } : {}),
        minimumQueryLength: completion.minimumQueryLength ?? DEFAULT_MINIMUM_QUERY_LENGTH,
        lookupDebounceMs: completion.lookupDebounceMs ?? DEFAULT_LOOKUP_DEBOUNCE_MS,
      })
    : undefined;
  const decorationSource: PlaceholderDecorationSource | undefined = decoration
    ? Object.freeze({
        candidates: decoration.candidates,
        invalidClassName: decoration.invalidClassName ?? DEFAULT_INVALID_CLASS_NAME,
      })
    : undefined;
  return resolved(
    {
      completion: completionSource,
      decoration: decorationSource,
      validationCandidates: decorationSource?.candidates,
    },
    extraIssues,
  );
}

/**
 * Resolve one configuration snapshot.
 *
 * - Neither path configured: every feature is off and no diagnostics exist,
 *   except the configuration error for values supplied without definitions.
 * - Definitions mixed with low-level configuration: everything is off and a
 *   `conflicting_configuration` diagnostic names `placeholderDefinitions`.
 * - Definitions whose catalog has any issue: everything is off and the
 *   catalog issues are reported.
 * - Valid definitions: completion opens at zero query characters, and
 *   completion, decoration and validation share one candidate list.
 * - Low-level configuration alone keeps its own behavior; token diagnostics
 *   exist only when decoration is configured.
 */
export function resolvePlaceholderConfiguration(
  configuration: PlaceholderEditorConfiguration | undefined,
): ResolvedPlaceholderConfiguration {
  if (!configuration) return UNCONFIGURED_PLACEHOLDERS;
  const { definitions, completion, decoration, valuesStatus = 'absent' } = configuration;
  const definitionsPresent = definitions !== undefined;
  const extraIssues = valuesIssues(valuesStatus, definitionsPresent);

  if (definitionsPresent && (completion !== undefined || decoration !== undefined)) {
    return resolved(
      { completion: undefined, decoration: undefined, validationCandidates: undefined },
      [
        configurationIssue(
          'conflicting_configuration',
          'placeholderDefinitions',
          'placeholderDefinitions cannot be combined with placeholderCompletion or placeholderDecoration.',
        ),
        ...extraIssues,
      ],
    );
  }
  if (definitionsPresent) return resolveDefinitions(definitions, extraIssues);
  return resolveLowLevel(completion, decoration, extraIssues);
}
