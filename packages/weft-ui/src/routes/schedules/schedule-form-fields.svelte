<script lang="ts">
  /**
   * Field body for the create/edit schedule drawer (Track B; design
   * `Weft New Surfaces.dc.html` §A2 — layout binding, see
   * `overlap-policy.ts`'s doc for the one deliberate copy departure).
   * Mutates the passed-in `form` (`ScheduleFormState`) instance directly —
   * a plain rune-backed class, not a bindable prop, so field edits here are
   * visible to the parent drawer without prop-drilling every field.
   *
   * `mode: 'edit'` disables only the fields `weft.schedules.update` cannot
   * change: workflow type, input payload, and start-paused. `description`,
   * overlap policy, jitter, backfill, and `revisionPolicy` are all editable
   * (COR-15 unlocked the first four; WFT-117 wired `revisionPolicy`) —
   * `ScheduleFormState.toUpdateOptions()` sends only the ones that changed.
   */
  import {
    Input,
    JsonEditor,
    RadioGroup,
    ScheduleBuilder,
    Select,
    Toggle,
    type ScheduleValue,
  } from '@lostgradient/cinder';
  import { TriangleAlert } from 'lucide-svelte';
  import { untrack } from 'svelte';

  import type { ScheduleOverlapPolicy, ScheduleRevisionPolicy } from '@lostgradient/weft';

  import { computeNextFires } from '../../lib/format/cron-preview.ts';
  import { FRESH_START_REVISION_HEDGE } from '../../lib/workflow-revision.ts';
  import { OVERLAP_POLICIES } from './overlap-policy.ts';
  import { REVISION_POLICIES } from './revision-policy.ts';
  import type { ScheduleFormState } from './schedule-form-state.svelte.ts';

  interface Props {
    form: ScheduleFormState;
    mode: 'create' | 'edit';
    /** Registry-driven workflow type options. `undefined` (still loading, errored, or `system:read` unavailable — the create action itself doesn't require it, plan §9.3) or an empty array (the registry resolved successfully but has no registered workflows) both fall back to a free-text field, but with distinct descriptions — "unavailable" vs "no registered workflow types found" — so an authorized schedule creator is never told the server is empty when the lookup merely hasn't settled yet. Only a non-empty array renders the Select. */
    workflowTypeOptions: readonly string[] | undefined;
  }

  let { form, mode, workflowTypeOptions }: Props = $props();

  function onCadenceChange(next: ScheduleValue): void {
    form.cadence = next;
  }

  const OVERLAP_VALUES: ReadonlySet<string> = new Set(
    OVERLAP_POLICIES.map((policy) => policy.value),
  );

  function isOverlapPolicy(value: string): value is ScheduleOverlapPolicy {
    return OVERLAP_VALUES.has(value);
  }

  /**
   * `RadioGroup.value` is a plain `$bindable() string`, not generic over
   * `ScheduleOverlapPolicy` — a proxy local avoids widening `form.overlap`'s
   * type to `string` via a direct `bind:value={form.overlap}`. Initialized
   * once from `form.overlap`; the only other writer of `form.overlap` is
   * `ScheduleFormState`'s own constructor, which always runs before this
   * component mounts, so a one-way write-back (draft → form) is sufficient —
   * no ping-pong sync needed back the other way.
   */
  let overlapDraft = $state(untrack(() => form.overlap));

  $effect(() => {
    if (isOverlapPolicy(overlapDraft)) form.overlap = overlapDraft;
  });

  const REVISION_POLICY_VALUES: ReadonlySet<string> = new Set(
    REVISION_POLICIES.map((policy) => policy.value),
  );

  function isRevisionPolicy(value: string): value is ScheduleRevisionPolicy {
    return REVISION_POLICY_VALUES.has(value);
  }

  /**
   * Same `RadioGroup.value`-is-a-plain-string proxy pattern as `overlapDraft`
   * above. Both drafts are submitted in edit mode (`toUpdateOptions()`), so
   * a stale one-shot capture is a real correctness bug: `schedule-form-drawer.svelte`'s edit-mode `$effect` can reconstruct
   * `form` as a brand-new `ScheduleFormState` — e.g. on a background
   * `editDetailQuery` refetch (window focus, an unrelated invalidation)
   * while this component stays mounted — and Svelte does not remount a
   * child just because a prop's VALUE changes identity, so a plain
   * one-shot initializer would keep the OLD draft and the write-back
   * effect below would push it onto the NEW form, silently reverting an
   * externally-applied `revisionPolicy` change (Codex review, PR #978,
   * round 2). Rather than diff `$state`-proxied prop identity here (Svelte
   * warns `state_proxy_equality_mismatch` on raw `!==` comparisons across a
   * reactive-class prop boundary — proxy identity is not the same object
   * the parent's `$state` wraps), the fix lives in the parent:
   * `schedule-form-drawer.svelte` wraps this component in `{#key form}`,
   * which destroys and recreates it whenever `form` is swapped — the same
   * "let a fresh mount see the current value at construction" idiom
   * `fork-dialog.svelte` already uses for `initialStep`. A one-shot
   * initializer is therefore correct again, this time genuinely one-shot
   * per logical form instance.
   */
  let revisionPolicyDraft = $state(untrack(() => form.revisionPolicy));

  $effect(() => {
    if (isRevisionPolicy(revisionPolicyDraft)) form.revisionPolicy = revisionPolicyDraft;
  });
</script>

<div class="weft-schedule-form">
  <section class="weft-schedule-form__section">
    <h3 class="weft-schedule-form__section-title">Basics</h3>
    {#if mode === 'create'}
      <Input
        id="weft-schedule-form-id"
        label="Schedule ID"
        description="Optional — auto-generated when left blank."
        placeholder="auto-generate"
        bind:value={form.id}
        error={form.errors.id ?? ''}
      />
    {/if}
    {#if mode === 'create' && workflowTypeOptions !== undefined && workflowTypeOptions.length > 0}
      <Select
        id="weft-schedule-form-workflow-type"
        label="Workflow type"
        bind:value={form.workflowType}
        options={workflowTypeOptions.map((type) => ({ value: type, label: type }))}
        error={form.errors.workflowType ?? ''}
      />
    {:else if mode === 'create'}
      <Input
        id="weft-schedule-form-workflow-type"
        label="Workflow type"
        description={workflowTypeOptions === undefined
          ? 'Registry lookup unavailable — enter the workflow type name.'
          : 'No registered workflow types found — enter the workflow type name.'}
        bind:value={form.workflowType}
        error={form.errors.workflowType ?? ''}
      />
    {:else}
      <Input
        id="weft-schedule-form-workflow-type"
        label="Workflow type"
        value={form.workflowType}
        disabled
      />
    {/if}
    <Input
      id="weft-schedule-form-description"
      label="Description"
      description="Optional — shown to operators alongside the schedule."
      bind:value={form.description}
    />
    {#if mode === 'create'}
      <JsonEditor
        id="weft-schedule-form-input"
        label="Input (JSON)"
        description="The payload passed to each launched run."
        rows={3}
        value={form.inputText}
        onValueChange={(next) => (form.inputText = next)}
        highlight
        validFeedbackVisible={false}
        error={form.errors.input ?? ''}
      />
    {/if}
  </section>

  <section class="weft-schedule-form__section">
    <h3 class="weft-schedule-form__section-title">Cadence</h3>
    <ScheduleBuilder
      value={form.cadence}
      onValueChange={onCadenceChange}
      {computeNextFires}
      timezoneLabel="UTC"
      label="Cadence"
    />
  </section>

  <section class="weft-schedule-form__section">
    <RadioGroup
      name="weft-schedule-overlap"
      label="If a run is still going when the next fire is due"
      variant="card"
      bind:value={overlapDraft}
    >
      {#each OVERLAP_POLICIES as policy (policy.value)}
        <RadioGroup.Option
          id={`weft-schedule-overlap-${policy.value}`}
          value={policy.value}
          label={policy.label}
          description={policy.consequence}
        />
      {/each}
    </RadioGroup>

    <div class="weft-schedule-form__row">
      <Input
        id="weft-schedule-form-jitter"
        label="Jitter"
        description="Random delay added to each fire."
        placeholder="30s"
        bind:value={form.jitterText}
        error={form.errors.jitter ?? ''}
      />
      <label class="weft-schedule-form__toggle-field">
        <Toggle
          id="weft-schedule-form-start-paused"
          label="Start paused"
          disabled={mode === 'edit'}
          bind:checked={form.startPaused}
        />
        <span class="weft-schedule-form__toggle-description">
          Created paused — no fires until you resume it.
        </span>
      </label>
    </div>

    <label class="weft-schedule-form__backfill">
      <Toggle
        id="weft-schedule-form-backfill"
        label="Backfill missed occurrences"
        bind:checked={form.backfill}
      />
    </label>
    {#if form.backfill}
      <div class="weft-schedule-form__backfill-warning">
        <TriangleAlert aria-hidden="true" size={14} />
        <span>
          If the schedule falls behind (for example, the engine was down), missed occurrences fire
          immediately in a bounded catch-up window instead of being skipped.
        </span>
      </div>
    {/if}
    {#if mode === 'edit'}
      <p class="weft-schedule-form__edit-note">
        Workflow type, input payload, and start-paused can only be set at creation.
      </p>
    {/if}
  </section>

  <section class="weft-schedule-form__section">
    <h3 class="weft-schedule-form__section-title">Revision policy</h3>
    <RadioGroup
      name="weft-schedule-revision-policy"
      label="Which revision future occurrences resolve against"
      variant="card"
      bind:value={revisionPolicyDraft}
    >
      {#each REVISION_POLICIES as policy (policy.value)}
        <RadioGroup.Option
          id={`weft-schedule-revision-policy-${policy.value}`}
          value={policy.value}
          label={policy.label}
          description={policy.consequence}
        />
      {/each}
    </RadioGroup>
    {#if mode === 'edit' && revisionPolicyDraft === 'pinned' && revisionPolicyDraft !== form.initialRevisionPolicy}
      <div class="weft-schedule-form__backfill-warning">
        <TriangleAlert aria-hidden="true" size={14} />
        <span>
          Saving captures whichever revision is active right now and pins future occurrences to it.
          {FRESH_START_REVISION_HEDGE}
        </span>
      </div>
    {/if}
  </section>
</div>

<style>
  .weft-schedule-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .weft-schedule-form__section {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .weft-schedule-form__section-title {
    margin: 0;
    font-size: var(--cinder-text-sm);
    font-weight: 600;
  }

  .weft-schedule-form__row {
    display: flex;
    gap: 10px;
    align-items: flex-start;
  }

  .weft-schedule-form__row > :global(*) {
    flex: 1;
  }

  .weft-schedule-form__toggle-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .weft-schedule-form__toggle-description,
  .weft-schedule-form__edit-note {
    font-size: var(--cinder-text-2xs);
    color: var(--cinder-text-disabled);
  }

  .weft-schedule-form__backfill-warning {
    display: flex;
    align-items: flex-start;
    gap: 9px;
    padding: 10px 12px;
    background: var(--cinder-color-warning-bg);
    border: 1px solid var(--cinder-color-warning-border);
    border-radius: var(--cinder-radius-md);
    color: var(--cinder-color-warning-fg);
    font-size: var(--cinder-text-xs);
  }

  .weft-schedule-form__edit-note {
    margin: 0;
  }
</style>
