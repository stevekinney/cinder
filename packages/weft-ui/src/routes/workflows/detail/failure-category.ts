/**
 * Failure-category → plain-language explanation (plan §9.2 Overview tab:
 * "failure-category badge + plain-language explanation per taxonomy").
 * Taxonomy is `application | timeout | cancellation | resource | system`
 * (weft v0.11.0 `src/core/types/identity.ts` `FailureCategory` doc) — this
 * module mirrors those exact five values plus `WorkflowState.failureCategory`'s
 * two absent cases: `undefined` (workflow never failed) and `null` (failed,
 * category undetermined).
 */
import type { FailureCategory } from '@lostgradient/weft';

const CATEGORY_EXPLANATION: Readonly<Record<FailureCategory, string>> = {
  application:
    'The workflow or an activity threw an error that did not match a timeout, cancellation, resource, or system failure.',
  timeout: 'An activity or the workflow itself exceeded its configured deadline.',
  cancellation: 'The workflow was cancelled before it could complete.',
  resource: 'A quota, memory, disk, or capacity limit was exceeded.',
  system: 'An engine, storage, or worker infrastructure fault caused the failure.',
};

/**
 * Plain-language explanation for a workflow's `failureCategory`. `null`
 * means the workflow failed but weft could not determine a category;
 * `undefined` means it never failed at all (callers should not render this
 * for a non-failed workflow — see `overview-tab.svelte`).
 */
export function failureCategoryExplanation(category: FailureCategory | null | undefined): string {
  if (category === undefined) return '';
  if (category === null) return 'This failure could not be classified.';
  return CATEGORY_EXPLANATION[category];
}

const CATEGORY_LABEL: Readonly<Record<FailureCategory, string>> = {
  application: 'application',
  timeout: 'timeout',
  cancellation: 'cancellation',
  resource: 'resource',
  system: 'system',
};

/** Sentence-case-safe badge label for a failure category; `'uncategorized'` for `null`. */
export function failureCategoryLabel(category: FailureCategory | null | undefined): string {
  if (category === undefined) return '';
  if (category === null) return 'uncategorized';
  return CATEGORY_LABEL[category];
}
