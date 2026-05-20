/**
 * Constraints DSL — types, authoring helper, and reference evaluator.
 *
 * Components with discriminated-union or cross-prop rules that JSON Schema
 * cannot cleanly represent author a `{name}.constraints.ts` sidecar calling
 * `defineConstraints`. The generator serializes it to `{name}.constraints.json`.
 * The evaluator (`evaluateConstraints`) is the reference implementation agents
 * and tooling use to verify attribute sets against the rules.
 *
 * Four combinators: `exactlyOne | anyOf | allOf | requires`.
 * Four predicate types: `{prop,equals}`, `{prop,exists}`, `{prop,nonEmpty}`, `{snippet}`.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Severity level attached to a constraint rule violation. */
export type ConstraintSeverity = 'error' | 'warning' | 'info';

/**
 * A single predicate evaluated against a `ComponentAttributes` map.
 *
 * - `{prop, equals}` — strict equality against the named attribute value.
 * - `{prop, exists}` — attribute key is present (any value, including null/false/'').
 * - `{prop, nonEmpty}` — attribute key exists and its value is not undefined, null, '',
 *   or an empty array.
 * - `{snippet}` — presence check for a named snippet; treated identically to
 *   `{prop, nonEmpty}` against the snippet name.
 * - `{allOf}` / `{anyOf}` — logical composition of child predicates.
 */
export type Predicate =
  | { prop: string; equals: string | number | boolean }
  | { prop: string; exists: true }
  | { prop: string; nonEmpty: true }
  | { snippet: string }
  | { allOf: Predicate[] }
  | { anyOf: Predicate[] };

/**
 * Rule combinator — determines how the `of: Predicate[]` list is evaluated.
 *
 * - `exactlyOne`: exactly one predicate must match; zero or 2+ → violation.
 * - `anyOf`: at least one predicate must match; zero matches → violation.
 * - `allOf`: all predicates must match; any non-match → violation.
 * - `requires`: `of` has exactly one entry; that predicate must match. Used for
 *   "if `when` then require X" rules where `anyOf` reads oddly with one entry.
 */
export type Combinator = 'exactlyOne' | 'anyOf' | 'allOf' | 'requires';

/**
 * A single constraint rule with an identifier, severity, human description,
 * combinator kind, an optional `when` guard, and a list of predicates.
 */
export type ConstraintRule = {
  id: string;
  severity: ConstraintSeverity;
  description: string;
  kind: Combinator;
  /** Rule only fires when this predicate matches; absent means always fires. */
  when?: Predicate;
  of: Predicate[];
};

/** A usage example that illustrates a rule (or its absence). */
export type ConstraintExample = {
  title: string;
  code: string;
  /** Rule id this invalid example demonstrates. Present only on invalid examples. */
  violates?: string;
};

/**
 * The top-level document authored per-component in `{name}.constraints.ts`
 * and serialized to `{name}.constraints.json` by the generator.
 */
export type ConstraintsDocument = {
  /** Kebab-case component id matching the directory name. */
  component: string;
  /** One-paragraph summary of what these constraints enforce. */
  summary: string;
  rules: ConstraintRule[];
  examples?: {
    valid?: ConstraintExample[];
    invalid?: ConstraintExample[];
  };
};

/**
 * Attribute map presented to the evaluator. Keys are prop names or snippet
 * names; values are the actual attribute values (or a boolean presence marker
 * for snippets). Missing keys mean the prop was not supplied.
 */
export type ComponentAttributes = Record<string, unknown>;

/** A single violation returned by `evaluateConstraints`. */
export type EvaluationViolation = {
  /** The rule id that was violated. */
  rule: string;
  severity: ConstraintSeverity;
  message: string;
};

// ---------------------------------------------------------------------------
// Authoring helper
// ---------------------------------------------------------------------------

/**
 * Identity helper for authoring constraint documents. Returns the argument
 * unchanged; its value is the type inference and editor autocomplete.
 *
 * @example
 * export default defineConstraints({
 *   component: 'button',
 *   summary: '...',
 *   rules: [...],
 * });
 */
export function defineConstraints(document: ConstraintsDocument): ConstraintsDocument {
  return document;
}

// ---------------------------------------------------------------------------
// Predicate evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluate a single predicate against the supplied attribute map.
 *
 * Predicate semantics:
 * - `{prop, equals}` — `attributes[prop] === equals`. Missing key → undefined → not equal.
 * - `{prop, exists}` — key is present in the map (including null, false, '').
 * - `{prop, nonEmpty}` — key exists AND value is not undefined, null, '', or [].
 * - `{snippet}` — non-empty presence check against the snippet name key.
 * - `{allOf}` — all child predicates match.
 * - `{anyOf}` — at least one child predicate matches.
 */
export function evaluatePredicate(predicate: Predicate, attributes: ComponentAttributes): boolean {
  if ('allOf' in predicate) {
    return predicate.allOf.every((child) => evaluatePredicate(child, attributes));
  }

  if ('anyOf' in predicate) {
    return predicate.anyOf.some((child) => evaluatePredicate(child, attributes));
  }

  if ('snippet' in predicate) {
    // Own-property check so inherited keys (e.g. `toString`) cannot satisfy
    // a missing snippet by accident.
    if (!Object.prototype.hasOwnProperty.call(attributes, predicate.snippet)) return false;
    return isNonEmpty(attributes[predicate.snippet]);
  }

  if ('equals' in predicate) {
    if (!Object.prototype.hasOwnProperty.call(attributes, predicate.prop)) return false;
    return attributes[predicate.prop] === predicate.equals;
  }

  if ('exists' in predicate) {
    return Object.prototype.hasOwnProperty.call(attributes, predicate.prop);
  }

  // nonEmpty
  if (!Object.prototype.hasOwnProperty.call(attributes, predicate.prop)) return false;
  return isNonEmpty(attributes[predicate.prop]);
}

function isNonEmpty(value: unknown): boolean {
  if (value === undefined || value === null || value === '' || value === false) return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
}

// ---------------------------------------------------------------------------
// When-clause gating
// ---------------------------------------------------------------------------

/**
 * Evaluate a rule's `when` guard. Returns `true` when the rule should fire
 * (i.e. the guard matches, or no guard was supplied).
 */
export function whenMatches(when: Predicate | undefined, attributes: ComponentAttributes): boolean {
  if (when === undefined) return true;
  return evaluatePredicate(when, attributes);
}

// ---------------------------------------------------------------------------
// Combinator evaluation
// ---------------------------------------------------------------------------

function evaluateCombinator(
  kind: Combinator,
  predicates: Predicate[],
  attributes: ComponentAttributes,
): boolean {
  switch (kind) {
    case 'exactlyOne': {
      const matchCount = predicates.filter((predicate) =>
        evaluatePredicate(predicate, attributes),
      ).length;
      return matchCount === 1;
    }
    case 'anyOf': {
      return predicates.some((predicate) => evaluatePredicate(predicate, attributes));
    }
    case 'allOf': {
      return predicates.every((predicate) => evaluatePredicate(predicate, attributes));
    }
    case 'requires': {
      // Semantic sugar over anyOf with a single entry; enforced to one predicate by convention.
      return predicates.some((predicate) => evaluatePredicate(predicate, attributes));
    }
  }
}

// ---------------------------------------------------------------------------
// Document-level evaluator
// ---------------------------------------------------------------------------

/**
 * Run all rules in a `ConstraintsDocument` against the given attribute map.
 * Returns the list of violations; an empty array means the attributes are valid.
 *
 * Violation message format: `"<rule.description> (rule: <rule.id>)"`.
 */
export function evaluateConstraints(
  document: ConstraintsDocument,
  attributes: ComponentAttributes,
): EvaluationViolation[] {
  const violations: EvaluationViolation[] = [];

  for (const rule of document.rules) {
    if (!whenMatches(rule.when, attributes)) continue;
    if (!evaluateCombinator(rule.kind, rule.of, attributes)) {
      violations.push({
        rule: rule.id,
        severity: rule.severity,
        message: `${rule.description} (rule: ${rule.id})`,
      });
    }
  }

  return violations;
}
