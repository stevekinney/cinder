<script lang="ts" module>
  /**
   * @cinder
   * @category navigation
   * @status stable
   * @purpose Ordered progress indicator that visualizes a fixed sequence of steps with completed, current, and upcoming states.
   * @tag navigation
   * @tag progress
   * @useWhen Walking the user through a multi-step wizard or checkout flow with strict ordering.
   * @useWhen Showing how far the user has advanced through a known number of stages.
   * @avoidWhen Switching between independent peer views with no order — use tabs instead.
   * @avoidWhen Showing ancestor hierarchy of the current page — use breadcrumbs instead.
   * @related tabs, breadcrumbs, pagination
   */
  export type { StepItem, StepsOrientation, StepsProps } from './steps.types.ts';
</script>

<script lang="ts">
  import type { StepsProps } from './steps.types.ts';
  import { cn } from '../../utilities/class-names.ts';
  import Check from 'lucide-svelte/icons/check';

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
      {@const hasHref = step.href !== undefined}
      {@const isInteractive = hasHref || step.onclick !== undefined}
      <li
        class="cinder-steps__item"
        data-cinder-state={state}
        aria-current={isCurrent && !isInteractive ? 'step' : undefined}
      >
        <span class="cinder-steps__marker" aria-hidden="true">
          {#if isComplete}
            <Check class="cinder-steps__check" />
          {:else}
            <span class="cinder-steps__index">{index + 1}</span>
          {/if}
        </span>
        {#if hasHref}
          <a
            class="cinder-steps__interactive cinder-steps__body"
            href={step.href}
            onclick={step.onclick}
            aria-current={isCurrent ? 'step' : undefined}
          >
            {#if isComplete}
              <span class="cinder-steps__sr-only">{completedLabel}</span>
              <span class="cinder-steps__sr-only-separator"> </span>
            {/if}
            <span class="cinder-steps__label">{step.label}</span>
            {#if step.description}
              <span class="cinder-steps__description">{step.description}</span>
            {/if}
          </a>
        {:else if step.onclick}
          <button
            type="button"
            class="cinder-steps__interactive cinder-steps__body"
            onclick={step.onclick}
            aria-current={isCurrent ? 'step' : undefined}
          >
            {#if isComplete}
              <span class="cinder-steps__sr-only">{completedLabel}</span>
              <span class="cinder-steps__sr-only-separator"> </span>
            {/if}
            <span class="cinder-steps__label">{step.label}</span>
            {#if step.description}
              <span class="cinder-steps__description">{step.description}</span>
            {/if}
          </button>
        {:else}
          <span class="cinder-steps__body">
            {#if isComplete}
              <span class="cinder-steps__sr-only">{completedLabel}</span>
              <span class="cinder-steps__sr-only-separator"> </span>
            {/if}
            <span class="cinder-steps__label">{step.label}</span>
            {#if step.description}
              <span class="cinder-steps__description">{step.description}</span>
            {/if}
          </span>
        {/if}
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
