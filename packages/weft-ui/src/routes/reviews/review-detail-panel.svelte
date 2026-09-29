<script lang="ts">
  /**
   * The detail/decision surface for one selected review (plan §9.5). Renders
   * one of three treatments depending on the entry's derived state:
   *   - pending, not timed out → artifact + `ReviewDecisionForm`.
   *   - pending, timed out (client-derived — see `review-domain.ts`) →
   *     a warning banner; the decision form is withheld (a decision
   *     submitted here may already 404 against the real server — plan §9.5
   *     "Completed archive read-only + timeout-expired treatment").
   *   - completed → a read-only recorded-decision summary, no form at all.
   */
  import { Alert, Badge, DescriptionList } from '@lostgradient/cinder';
  import CircleCheck from 'lucide-svelte/icons/circle-check';
  import type { CompletedReviewEntry, PendingReviewEntry } from '@lostgradient/weft';

  import { formatRelativeTime, truncateId } from '../../lib/format/index.ts';
  import ArtifactView from './artifact-view.svelte';
  import {
    extractReviewMetadataEntries,
    extractReviewSections,
    humanizeKey,
    isReviewTimedOut,
  } from './review-domain.ts';
  import ReviewDecisionForm, { type ReviewDecisionSubmission } from './review-decision-form.svelte';

  interface ReviewDetailPanelProps {
    readonly entry: PendingReviewEntry | CompletedReviewEntry;
    readonly now: number;
    readonly submitting: boolean;
    readonly onSubmit: (reviewId: string, submission: ReviewDecisionSubmission) => void;
  }

  let { entry, now, submitting, onSubmit }: ReviewDetailPanelProps = $props();

  const sections = $derived(extractReviewSections(entry.artifact));
  const metadataEntries = $derived(extractReviewMetadataEntries(entry.artifact));
  const timedOut = $derived(entry.status === 'pending' ? isReviewTimedOut(entry, now) : false);
</script>

<div class="weft-review-detail">
  <header class="weft-review-detail__header">
    <h2 class="weft-review-detail__title">{entry.reviewType}</h2>
    <p class="weft-review-detail__meta">
      Workflow
      <span class="weft-review-detail__id" title={entry.workflowId}
        >{truncateId(entry.workflowId)}</span
      >
      · requested {formatRelativeTime(entry.createdAt, now)}
    </p>
  </header>

  {#if entry.status === 'completed'}
    <Alert variant="success">
      <CircleCheck size={16} aria-hidden="true" />
      Decided by {entry.reviewer} — {formatRelativeTime(entry.timestamp, now)}
    </Alert>
  {:else if timedOut}
    <Alert variant="warning">
      The timeout has passed. The workflow will proceed with its default behavior; this review can
      no longer be decided.
    </Alert>
  {/if}

  {#if metadataEntries.length > 0}
    <DescriptionList
      variant="two-column"
      items={metadataEntries.map(([key, value]) => ({
        term: humanizeKey(key),
        definition: typeof value === 'string' ? value : JSON.stringify(value),
      }))}
    />
  {/if}

  {#if sections}
    <div class="weft-review-artifact-sections">
      {#each Object.entries(sections) as [key, value] (key)}
        <div class="weft-review-artifact-section">
          <h3 class="weft-review-artifact-section__title">{humanizeKey(key)}</h3>
          <ArtifactView {value} label={humanizeKey(key)} />
        </div>
      {/each}
    </div>
  {:else}
    <ArtifactView value={entry.artifact} label="Artifact" />
  {/if}

  {#if entry.status === 'completed'}
    <div class="weft-review-recorded-feedback">
      <span class="weft-review-recorded-feedback__label">Recorded feedback</span>
      <p class="weft-review-recorded-feedback__body">{entry.feedback ?? 'No feedback recorded.'}</p>
      {#if entry.sectionDecisions}
        <div class="weft-review-recorded-sections">
          {#each Object.entries(entry.sectionDecisions) as [key, decision] (key)}
            <Badge variant={decision === 'approved' ? 'success' : 'danger'} size="sm">
              {humanizeKey(key)}: {decision === 'approved' ? 'Approved' : 'Rejected'}
            </Badge>
          {/each}
        </div>
      {/if}
    </div>
  {:else if !timedOut}
    <ReviewDecisionForm
      reviewId={entry.reviewId}
      sectionKeys={sections ? Object.keys(sections) : []}
      {submitting}
      onSubmit={(submission) => onSubmit(entry.reviewId, submission)}
    />
  {/if}
</div>
