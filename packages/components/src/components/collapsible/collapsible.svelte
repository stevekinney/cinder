<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status stable
   * @purpose Single-panel disclosure that toggles one region with an animated height.
   * @tag disclosure
   * @tag collapsible
   * @useWhen Hiding a single optional region behind a labeled trigger.
   * @useWhen You need controlled or uncontrolled show/hide with an accessible toggle.
   * @avoidWhen Coordinating multiple sections where opening one may close others — use accordion.
   * @related accordion
   * @related accordion-item
   */
  export type { CollapsibleProps, CollapsibleTriggerState } from './collapsible.types.ts';
</script>

<script lang="ts">
  import { slide } from 'svelte/transition';

  import { classNames } from '../../utilities/class-names.ts';
  import { useReducedMotion } from '../../utilities/use-reduced-motion.svelte.ts';

  import type { CollapsibleProps } from './collapsible.types.ts';

  let {
    trigger,
    children,
    open = $bindable(false),
    ontoggle,
    disabled = false,
    triggerAriaLabel,
    idBase,
    class: className,
    ...rest
  }: CollapsibleProps = $props();

  // Slide duration mirrors --cinder-duration (200ms); collapse to 0 when the
  // user prefers reduced motion.
  const SLIDE_MS = 200;
  const motion = useReducedMotion();
  const slideMs = $derived(motion.current ? 0 : SLIDE_MS);

  const autoId = $props.id();
  const baseId = $derived(idBase ?? autoId);
  const headerId = $derived(`${baseId}-header`);
  const panelId = $derived(`${baseId}-panel`);
  const computedTriggerAriaLabel = $derived.by(() =>
    typeof triggerAriaLabel === 'function'
      ? triggerAriaLabel({ open, disabled })
      : triggerAriaLabel,
  );

  function handleClick(): void {
    if (disabled) return;
    const next = !open;
    open = next;
    ontoggle?.(next);
  }
</script>

<div
  {...rest}
  class={classNames('cinder-collapsible', className)}
  data-cinder-expanded={open ? '' : undefined}
  data-cinder-disabled={disabled ? '' : undefined}
>
  <button
    type="button"
    id={headerId}
    class="cinder-collapsible__trigger"
    aria-label={computedTriggerAriaLabel}
    aria-expanded={open}
    aria-controls={open ? panelId : undefined}
    {disabled}
    onclick={handleClick}
  >
    <span class="cinder-collapsible__label">
      {#if typeof trigger === 'string'}
        {trigger}
      {:else}
        {@render trigger({ open, disabled })}
      {/if}
    </span>
    <svg
      class="cinder-collapsible__chevron"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill-rule="evenodd"
        d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06z"
        clip-rule="evenodd"
      />
    </svg>
  </button>

  {#if open}
    <div
      transition:slide={{ duration: slideMs }}
      id={panelId}
      role="region"
      aria-labelledby={headerId}
      class="cinder-collapsible__panel"
    >
      <div class="cinder-collapsible__panel-inner">
        {@render children()}
      </div>
    </div>
  {/if}
</div>
