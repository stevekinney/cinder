/**
 * The accessibility gate for the broad component sweep
 * (`tests/components.playwright.ts`).
 *
 * The sweep runs `runAxe()` across every component in two themes × three
 * viewports and buckets violations by impact. This module decides which of
 * those buckets are *blocking* (fail CI) and provides an explicit, documented
 * allow-list so a known pre-existing violation can be recorded as an exception
 * — with a required reason — rather than silently tolerated or forcing a
 * zero-violation baseline on day one.
 *
 * Policy:
 * - `critical` and `serious` violations are blocking by default.
 * - `moderate` and `minor` violations are recorded as annotations only, to
 *   avoid noise from low-severity findings.
 * - A component/fixture combination may be allow-listed in {@link AXE_ALLOW_LIST}
 *   for specific axe rule ids with a tracking reason; only those rules are
 *   downgraded to annotations. A blocking violation whose rule id is not
 *   allow-listed still fails, so new regressions are caught even on allow-listed
 *   components.
 *
 * The four targeted assertions in `tests/a11y-regressions.playwright.ts` are
 * intentionally stricter (they assert *zero* violations of any impact) and do
 * not use this gate.
 */

import type { ArtifactKey } from './artifact-path.ts';
import type { AxeBuckets, AxeImpact, AxeViolation } from './axe.ts';

/**
 * Impacts that fail the broad sweep. `moderate` and `minor` are deliberately
 * excluded so low-severity findings stay informational.
 */
export const BLOCKING_IMPACTS: readonly AxeImpact[] = ['critical', 'serious'] as const;

/**
 * A single documented exception to the accessibility gate.
 *
 * Matching is by component `slug`, optionally narrowed to a specific `theme`,
 * `viewport`, and/or `fixture`. An entry with only a `slug` (plus narrowers)
 * scopes the exception to that component, but `ruleIds` further restricts it to
 * the specific axe rules it was created for. Each entry MUST carry a `reason`
 * and a non-empty `ruleIds` list so the exception is auditable and removable.
 */
export type AxeAllowEntry = {
  /** Component slug from the manifest (kebab-case). */
  slug: string;
  /** Restrict the exception to a single theme. Omit to match every theme. */
  theme?: ArtifactKey['theme'];
  /** Restrict the exception to a single viewport. Omit to match every viewport. */
  viewport?: ArtifactKey['viewport'];
  /** Restrict the exception to a single fixture. Omit to match every fixture. */
  fixture?: string;
  /**
   * The exact axe rule ids this entry downgrades (e.g. `['color-contrast']`).
   * Only blocking violations whose `id` is in this list are treated as allowed;
   * any other blocking violation in the same scope still fails the gate, so a
   * brand-new regression on an allow-listed component is never silently masked.
   * Required and non-empty.
   */
  ruleIds: readonly string[];
  /**
   * Why this combination is allow-listed: the pre-existing violation(s) and a
   * tracking note (issue link, follow-up task, etc.). Required and non-empty.
   */
  reason: string;
};

/**
 * Explicit allow-list of known, pre-existing accessibility violations.
 *
 * This list is the documented escape hatch the gate is built around: the gate
 * does NOT require a zero-violation baseline on day one. When the sweep
 * surfaces a `critical`/`serious` violation that cannot be fixed immediately,
 * add an entry here with a `reason` (and a tracking link) rather than weakening
 * the gate globally. Each entry should be removed as the underlying violation
 * is fixed.
 *
 * The baseline below was captured by running the full broad sweep
 * (`bun run scripts/start-server.ts` → 134 components × 2 themes × 3 viewports)
 * against the playground on 2026-05-29. Every entry records the exact axe rule
 * ids it covers in `ruleIds`; only those rules are downgraded, so a *new*
 * critical/serious regression on an allow-listed component still fails the gate.
 * Color-contrast findings are theme-scoped because contrast depends on the
 * active palette; structural findings (nested-interactive, svg-img-alt, etc.)
 * reproduce across every theme/viewport, so those entries match by slug alone.
 *
 * An empty list would mean the gate is fully enforced for every component.
 */
export const AXE_ALLOW_LIST: readonly AxeAllowEntry[] = [
  {
    slug: 'area-chart',
    ruleIds: ['nested-interactive', 'svg-img-alt'],
    reason:
      'Pre-existing serious violations: nested-interactive and svg-img-alt on the SVG chart. ' +
      'Charts render interactive data points inside the <svg> without a non-nested control and ' +
      'without alt text for the img-role SVG. Tracking: chart-a11y follow-up.',
  },
  {
    slug: 'bar-chart',
    ruleIds: ['nested-interactive', 'svg-img-alt'],
    reason:
      'Pre-existing serious violations: nested-interactive and svg-img-alt on the SVG chart. ' +
      'Same root cause as area-chart (shared chart primitives). Tracking: chart-a11y follow-up.',
  },
  {
    slug: 'line-chart',
    ruleIds: ['nested-interactive', 'svg-img-alt'],
    reason:
      'Pre-existing serious violations: nested-interactive and svg-img-alt on the SVG chart. ' +
      'Same root cause as area-chart (shared chart primitives). Tracking: chart-a11y follow-up.',
  },
  {
    slug: 'avatar-group',
    ruleIds: ['aria-prohibited-attr'],
    reason:
      'Pre-existing serious violation: aria-prohibited-attr — an aria-* attribute is set on an ' +
      'element whose role does not permit it. Tracking: avatar-group-a11y follow-up.',
  },
  {
    slug: 'progress',
    ruleIds: ['aria-progressbar-name'],
    reason:
      'Pre-existing serious violation: aria-progressbar-name — the progressbar node lacks an ' +
      'accessible name. Tracking: progress-a11y follow-up.',
  },
  {
    slug: 'tag-input',
    ruleIds: ['nested-interactive'],
    reason:
      'Pre-existing serious violation: nested-interactive — the removable-tag control is nested ' +
      'inside another interactive element. Tracking: tag-input-a11y follow-up.',
  },
  {
    slug: 'code-block',
    ruleIds: ['color-contrast', 'scrollable-region-focusable'],
    reason:
      'Pre-existing serious violations: color-contrast (all viewports) and ' +
      'scrollable-region-focusable (the scrollable code region lacks keyboard access, surfaces in ' +
      'the mobile viewport). Tracking: code-block-a11y follow-up.',
  },
  {
    slug: 'table',
    theme: 'light',
    ruleIds: ['color-contrast'],
    reason:
      'Pre-existing serious violation: color-contrast in the light theme (all viewports). ' +
      'Tracking: table-light-contrast follow-up.',
  },
  {
    slug: 'chip',
    theme: 'light',
    ruleIds: ['color-contrast'],
    reason:
      'Pre-existing serious violation: color-contrast in the light theme (all viewports). ' +
      'Tracking: chip-light-contrast follow-up.',
  },
  {
    slug: 'copy-button',
    theme: 'dark',
    ruleIds: ['color-contrast'],
    reason:
      'Pre-existing serious violation: color-contrast in the dark theme (all viewports). ' +
      'Tracking: copy-button-dark-contrast follow-up.',
  },
];

/**
 * Returns the blocking (`critical` + `serious`) violations from a bucketed axe
 * result, in a stable, severity-ordered list.
 */
export function blockingViolations(buckets: AxeBuckets): AxeViolation[] {
  return BLOCKING_IMPACTS.flatMap((impact) => buckets[impact]);
}

/**
 * Finds the allow-list entry that covers a given artifact key, or `undefined`
 * when none applies. An entry matches when its `slug` equals the key's slug and
 * each of its optional `theme`/`viewport`/`fixture` narrowers (when present)
 * equals the corresponding key field.
 */
export function findAllowEntry(
  key: ArtifactKey,
  allowList: readonly AxeAllowEntry[] = AXE_ALLOW_LIST,
): AxeAllowEntry | undefined {
  return allowList.find(
    (entry) =>
      entry.slug === key.slug &&
      (entry.theme === undefined || entry.theme === key.theme) &&
      (entry.viewport === undefined || entry.viewport === key.viewport) &&
      (entry.fixture === undefined || entry.fixture === key.fixture),
  );
}

/**
 * Formats a list of blocking violations into a single human-readable message
 * for an assertion failure: the rule id, impact, help text, help URL, and the
 * first failing node's selector for each violation.
 */
export function formatBlockingViolations(key: ArtifactKey, violations: AxeViolation[]): string {
  const header = `${key.slug} (${key.theme}/${key.viewport}/${key.fixture}) has ${violations.length} blocking axe violation(s):`;
  const lines = violations.map((violation) => {
    const firstTarget = violation.nodes[0]?.target;
    const selector =
      firstTarget === undefined ? '(no node)' : JSON.stringify(firstTarget.flat().join(' '));
    return `  - [${violation.impact}] ${violation.id}: ${violation.help} (${violation.helpUrl}) at ${selector}`;
  });
  return [header, ...lines].join('\n');
}

/** The decision the gate reaches for a single artifact key. */
export type AxeGateDecision =
  | { status: 'pass' }
  | { status: 'fail'; violations: AxeViolation[]; message: string }
  | { status: 'allowed'; violations: AxeViolation[]; reason: string };

/**
 * Evaluates the accessibility gate for one artifact key.
 *
 * - `pass`: no blocking violations.
 * - `allowed`: every blocking violation is covered by a matching
 *   {@link AXE_ALLOW_LIST} entry's `ruleIds`; the caller should annotate, not
 *   fail.
 * - `fail`: at least one blocking violation is not covered — either the key is
 *   not allow-listed at all, or it is allow-listed but a blocking violation's
 *   rule id is outside the entry's `ruleIds` (a new regression). The caller
 *   should fail the test with `message`, which lists only the un-allowed
 *   violations.
 */
export function evaluateAxeGate(
  key: ArtifactKey,
  buckets: AxeBuckets,
  allowList: readonly AxeAllowEntry[] = AXE_ALLOW_LIST,
): AxeGateDecision {
  const violations = blockingViolations(buckets);
  if (violations.length === 0) {
    return { status: 'pass' };
  }

  const allowEntry = findAllowEntry(key, allowList);
  if (allowEntry === undefined) {
    return { status: 'fail', violations, message: formatBlockingViolations(key, violations) };
  }

  const allowedRuleIds = new Set(allowEntry.ruleIds);
  const unallowed = violations.filter((violation) => !allowedRuleIds.has(violation.id));
  if (unallowed.length > 0) {
    return {
      status: 'fail',
      violations: unallowed,
      message: formatBlockingViolations(key, unallowed),
    };
  }

  return { status: 'allowed', violations, reason: allowEntry.reason };
}
