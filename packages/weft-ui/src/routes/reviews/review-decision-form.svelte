<script lang="ts">
  /**
   * The decision-recording surface for a pending review (plan §9.5, Track
   * D). NOT built on Cinder's `ApprovalCard` — see the module doc below for
   * the evaluation this task required documenting.
   *
   * ## ApprovalCard evaluation (required by the task brief)
   *
   * Read `cinder/components/cinder/src/components/approval-card/{approval-card.svelte,README.md,approval-card.types.ts}`
   * in full before building this. `ApprovalCard` is a real, shipped
   * component (v0.16.1) but its domain model is a DIFFERENT one: "reviewing
   * a tool operation before the host application executes it" — required
   * props are `tool: { name, risk }`, `sandbox: { provider, name,
   * workingDir }`, `operation: { kind: 'command' | 'patch', command | diff,
   * argsPreview, filesTouched }`, `policyVersion`, `idempotencyKey`,
   * `expiresAt`, and a SINGLE `onresolve(resolution)` callback carrying one
   * `ApprovalResolution` (`decision: 'approve' | 'approve-with-edits' |
   * 'deny' | 'cancel'`). None of that maps onto a Weft human review:
   *   - No concept of `reviewType`/`reviewers`/arbitrary `artifact` content
   *     (Weft's artifact is `unknown` — free-form, not a command/diff).
   *   - No per-SECTION decisions at all — `allowPartial`'s whole point (an
   *     independent approve/reject per named artifact section) has no
   *     analogue in a single `onresolve` callback.
   *   - `sandbox`/`policyVersion`/`idempotencyKey`/`env` are agent-tool-call
   *     concepts with no Weft review equivalent to supply.
   * Forcing the review's shape into `ApprovalCard`'s props would mean
   * inventing fake `tool`/`sandbox`/`operation` values purely to satisfy an
   * unrelated required-prop contract, and would still have nowhere to put
   * per-section decisions — exactly the "fork/wrap to change semantics"
   * pattern PROJECT-BRIEF forbids, just done through misuse of required
   * props instead of a literal fork. This is a domain mismatch, not a
   * missing prop/state gap, so no Cinder issue is filed either — the
   * decision surface below is an app-local composition over `Card`,
   * `Badge`, `SegmentedControl`, `Textarea`, and `Button`, matching how the
   * design reference itself hand-builds this screen rather than embedding
   * `ApprovalCard` markup.
   *
   * ## "Suggested from sections but never locked" (plan §9.5)
   *
   * `overallDecision` auto-follows `suggestOverallDecision(sectionDecisions)`
   * (all sections approved → approve; any rejection → needs-changes) UNTIL
   * the operator picks an overall option themselves — tracked by
   * `overallTouched`. Once touched, the picker keeps whatever the operator
   * chose (still fully clickable to any option — "never locked" means the
   * suggestion never disables the control, not that it stops suggesting).
   *
   * ## Partial means per-section, not "every section required"
   *
   * `sectionDecisions` may cover a subset of `sectionKeys` — `allowPartial`
   * describes decision GRANULARITY (independent per-section verdicts), not
   * a requirement that every section be decided before submitting. Only the
   * overall decision (and feedback when rejecting/requesting changes) gate
   * the submit button.
   */
  import type { ReviewDecision } from '@lostgradient/weft';

  import {
    Badge,
    Button,
    Card,
    Input,
    Segment,
    SegmentedControl,
    Textarea,
  } from '@lostgradient/cinder';

  import { humanizeKey, suggestOverallDecision, type SectionDecision } from './review-domain.ts';

  export interface ReviewDecisionSubmission {
    readonly decision: ReviewDecision;
    readonly reviewer: string;
    readonly feedback?: string;
    readonly sectionDecisions?: Record<string, SectionDecision>;
  }

  interface ReviewDecisionFormProps {
    readonly reviewId: string;
    readonly sectionKeys: readonly string[];
    readonly submitting: boolean;
    readonly onSubmit: (submission: ReviewDecisionSubmission) => void;
  }

  let { reviewId, sectionKeys, submitting, onSubmit }: ReviewDecisionFormProps = $props();

  let sectionDecisions = $state<Map<string, SectionDecision>>(new Map());
  let overallDecision = $state<ReviewDecision | undefined>(undefined);
  let overallTouched = $state(false);
  let reviewer = $state('');
  let feedback = $state('');

  const suggestedDecision = $derived(suggestOverallDecision(sectionDecisions));

  $effect(() => {
    if (overallTouched) return;
    overallDecision = suggestedDecision ?? undefined;
  });

  function setSectionDecision(key: string, decision: SectionDecision | undefined): void {
    const next = new Map(sectionDecisions);
    if (decision === undefined) next.delete(key);
    else next.set(key, decision);
    sectionDecisions = next;
  }

  function setOverallDecision(value: string): void {
    overallTouched = true;
    overallDecision = value as ReviewDecision;
  }

  const feedbackRequired = $derived(
    overallDecision === 'rejected' || overallDecision === 'needs-changes',
  );
  const canSubmit = $derived(
    !submitting &&
      overallDecision !== undefined &&
      reviewer.trim().length > 0 &&
      (!feedbackRequired || feedback.trim().length > 0),
  );

  function submit(): void {
    if (!canSubmit || overallDecision === undefined) return;
    onSubmit({
      decision: overallDecision,
      reviewer: reviewer.trim(),
      ...(feedback.trim().length > 0 ? { feedback: feedback.trim() } : {}),
      ...(sectionDecisions.size > 0
        ? { sectionDecisions: Object.fromEntries(sectionDecisions) }
        : {}),
    });
  }
</script>

{#if sectionKeys.length > 0}
  <Card title="Section decisions" description="Partial allowed — decide sections independently.">
    <div class="weft-review-sections">
      {#each sectionKeys as key (key)}
        {@const controlId = `review-section-${reviewId}-${key}`}
        {@const current = sectionDecisions.get(key)}
        <div class="weft-review-section-row">
          <span class="weft-review-section-label">{humanizeKey(key)}</span>
          <SegmentedControl
            id={controlId}
            selectionMode="single"
            label={`${humanizeKey(key)} decision`}
            labelVisible={false}
            size="sm"
            value={current ?? ''}
            selectionRequired={false}
            onValueChange={(value) =>
              setSectionDecision(key, (value || undefined) as SectionDecision | undefined)}
          >
            <Segment value="approved">Approve</Segment>
            <Segment value="rejected">Reject</Segment>
          </SegmentedControl>
        </div>
      {/each}
    </div>
  </Card>
{/if}

<Card title="Your decision">
  <div class="weft-review-decision">
    <SegmentedControl
      id={`review-overall-${reviewId}`}
      selectionMode="single"
      label="Overall decision"
      fullWidth
      value={overallDecision ?? ''}
      onValueChange={(value) => setOverallDecision(value)}
      class="weft-review-decision-segments"
    >
      <Segment value="approved">Approve</Segment>
      <Segment value="rejected">Reject</Segment>
      <Segment value="needs-changes">Changes</Segment>
    </SegmentedControl>

    {#if suggestedDecision && !overallTouched}
      <Badge variant="info" size="sm">Suggested from sections</Badge>
    {/if}

    <Input
      id={`review-reviewer-${reviewId}`}
      label="Reviewer"
      description="Your name or email — recorded with the decision."
      bind:value={reviewer}
      required
    />

    <Textarea
      id={`review-feedback-${reviewId}`}
      label={feedbackRequired ? 'Feedback' : 'Feedback (optional for approve)'}
      description="A note for the workflow and future reviewers."
      bind:value={feedback}
      rows={3}
    />

    <Button
      variant="primary"
      label={submitting ? 'Submitting…' : 'Submit decision'}
      disabled={!canSubmit}
      loading={submitting}
      onclick={submit}
    />
  </div>
</Card>
