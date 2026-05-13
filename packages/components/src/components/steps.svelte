<script lang="ts" module>
  export type StepsOrientation = 'horizontal' | 'vertical';

  export type StepItem = {
    /** Stable identifier used as the keyed-each key. Must be unique. */
    id: string;
    /** Visible label for the step. */
    label: string;
    /** Optional secondary text shown beneath the label. */
    description?: string;
  };

  export type StepsProps = {
    /** Ordered list of step entries from first to last. */
    steps: StepItem[];
    /**
     * Zero-based index of the active step. Steps with index < currentStep are
     * "completed". Pass `steps.length` to mark every step as complete (terminal
     * "done" state).
     */
    currentStep: number;
    /** Layout direction. Defaults to 'horizontal'. */
    orientation?: StepsOrientation;
    /** Accessible name for the wrapping nav landmark. Defaults to 'Progress'. */
    label?: string;
    /**
     * Visually-hidden text prepended to completed steps so screen readers
     * announce state + label. Defaults to 'Completed'.
     */
    completedLabel?: string;
    /** Additional class names merged with `.cinder-steps`. */
    class?: string;
  };
</script>

<script lang="ts">
  import { cn } from '../utilities/class-names.ts';
  import { Check } from './icons/index.ts';

  let {
    steps,
    currentStep,
    orientation = 'horizontal',
    label = 'Progress',
    completedLabel = 'Completed',
    class: className,
  }: StepsProps = $props();

  const clampedCurrent = $derived(
    steps.length === 0 ? undefined : Math.max(0, Math.min(steps.length, currentStep)),
  );

  type StepState = 'complete' | 'current' | 'upcoming';

  const stepStates = $derived<StepState[]>(
    steps.map((_, index) => {
      if (clampedCurrent === undefined) return 'upcoming';
      if (index < clampedCurrent) return 'complete';
      if (index === clampedCurrent) return 'current';
      return 'upcoming';
    }),
  );
</script>

<nav class={cn('cinder-steps', className)} aria-label={label} data-cinder-orientation={orientation}>
  <ol class="cinder-steps__list">
    {#each steps as step, index (step.id)}
      {@const state = stepStates[index]}
      {@const isCurrent = state === 'current'}
      {@const isComplete = state === 'complete'}
      <li
        class="cinder-steps__item"
        data-cinder-state={state}
        {...isCurrent ? { 'aria-current': 'step' } : {}}
      >
        <span class="cinder-steps__marker" aria-hidden="true">
          {#if isComplete}
            <Check class="cinder-steps__check" />
          {:else}
            <span class="cinder-steps__index">{index + 1}</span>
          {/if}
        </span>
        <span class="cinder-steps__body">
          {#if isComplete}
            <span class="cinder-steps__sr-only">{completedLabel}</span>
          {/if}
          <span class="cinder-steps__label">{step.label}</span>
          {#if step.description}
            <span class="cinder-steps__description">{step.description}</span>
          {/if}
        </span>
        {#if index < steps.length - 1}
          <span
            class="cinder-steps__connector"
            data-cinder-state={isComplete ? 'complete' : 'upcoming'}
            aria-hidden="true"
          ></span>
        {/if}
      </li>
    {/each}
  </ol>
</nav>
