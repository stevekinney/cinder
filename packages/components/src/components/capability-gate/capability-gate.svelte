<script lang="ts" module>
  /**
   * @cinder
   * @category feedback
   * @status alpha
   * @purpose Present feature availability and next action for browser permission or support states, with accessible status text and focus management.
   * @tag feedback
   * @tag permission
   * @tag notice
   * @useWhen Surfacing that a feature requires a browser permission such as microphone or notifications.
   * @useWhen Communicating that a feature is unsupported in the current browser with a clear fallback path.
   * @avoidWhen Performing the actual feature detection or permission request — wire that in userland.
   * @avoidWhen Storing permission state — CapabilityGate is a pure presentation component.
   * @related alert, banner, callout, modal
   */
  export type {
    CapabilityGateProps,
    CapabilityGateState,
    CapabilityGateVariant,
  } from './capability-gate.types.ts';

  /** Human-readable default status text per state. */
  const DEFAULT_STATUS_TEXT: Record<string, string> = {
    supported: 'Available',
    unsupported: 'Not supported in this browser',
    'permission-needed': 'Permission required',
    'permission-denied': 'Permission was denied',
    loading: 'Checking availability…',
    unavailable: 'Not available',
  };
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';
  import { devWarn } from '../../utilities/dev-warn.ts';
  import type { CapabilityGateProps } from './capability-gate.types.ts';

  const KNOWN_STATES = [
    'supported',
    'unsupported',
    'permission-needed',
    'permission-denied',
    'loading',
    'unavailable',
  ] as const;

  let {
    feature,
    // Destructured off `state` to avoid svelte-check treating the bare identifier
    // as the `$state` rune (the public prop name is still `state`).
    state: stateProp,
    variant = 'inline',
    primaryAction,
    onPrimaryAction,
    fallbackAction,
    fallbackHref,
    onFallbackAction,
    dismissAction,
    ondismiss,
    children,
    class: customClassName,
    ...rest
  }: CapabilityGateProps = $props();

  // Guard the runtime state: a plain-JS or malformed value falls back to
  // `unavailable` (with a dev warning) rather than rendering an unknown
  // data-cinder-state and the raw value as status text.
  const availabilityState = $derived(
    (KNOWN_STATES as readonly string[]).includes(stateProp) ? stateProp : 'unavailable',
  );
  $effect(() => {
    if (!(KNOWN_STATES as readonly string[]).includes(stateProp)) {
      devWarn(
        `CapabilityGate: unknown state "${String(stateProp)}". Expected one of ${KNOWN_STATES.join(', ')}. Falling back to "unavailable".`,
      );
    }
  });

  let visible = $state(true);
  let dismissButton: HTMLButtonElement | undefined = $state();

  // Re-show the gate when the situation changes (e.g. permission-needed →
  // permission-denied), so a previous dismissal doesn't permanently hide a new,
  // possibly more urgent state. Reads feature + stateProp to track them.
  $effect(() => {
    void feature;
    void stateProp;
    visible = true;
  });

  const statusText = $derived(DEFAULT_STATUS_TEXT[availabilityState] ?? availabilityState);
  const isLoading = $derived(availabilityState === 'loading');
  const isError = $derived(
    availabilityState === 'permission-denied' || availabilityState === 'unsupported',
  );
  const isWarning = $derived(availabilityState === 'permission-needed');
  const isSuccess = $derived(availabilityState === 'supported');

  const resolvedVariant = $derived(
    isError ? 'error' : isWarning ? 'warning' : isSuccess ? 'success' : 'info',
  );

  function handleDismiss() {
    // Blur the dismiss button before it unmounts so focus moves to <body>
    // predictably rather than being stranded on a detached node. The consumer
    // owns where focus should land next (e.g. a trigger to re-open the gate) and
    // can set it in `ondismiss` — the component cannot know the right target.
    dismissButton?.blur();
    visible = false;
    ondismiss?.();
  }
</script>

{#if visible}
  <div
    {...rest}
    class={classNames('cinder-capability-gate', customClassName)}
    data-cinder-state={availabilityState}
    data-cinder-variant={resolvedVariant}
    data-cinder-presentation={variant}
  >
    <!-- Status text announced to assistive technology. aria-busy lives on the
         live region so a loading→ready transition is announced consistently. -->
    <div
      class="cinder-capability-gate__status"
      role="status"
      aria-live="polite"
      aria-busy={isLoading ? 'true' : undefined}
    >
      <span class="cinder-capability-gate__feature">{feature}</span>
      <span class="cinder-capability-gate__state-text">{statusText}</span>
    </div>

    {#if children}
      <div class="cinder-capability-gate__content">
        {@render children()}
      </div>
    {/if}

    {#if primaryAction || fallbackAction || fallbackHref || dismissAction}
      <div class="cinder-capability-gate__actions">
        {#if primaryAction}
          <button
            type="button"
            class="cinder-capability-gate__primary"
            onclick={onPrimaryAction}
            aria-label="{primaryAction} for {feature}"
          >
            {primaryAction}
          </button>
        {/if}

        {#if fallbackHref}
          <a
            href={fallbackHref}
            class="cinder-capability-gate__fallback"
            aria-label="{fallbackAction ?? 'Alternative option'} for {feature}"
          >
            {fallbackAction ?? 'Alternative option'}
          </a>
        {:else if fallbackAction}
          <button
            type="button"
            class="cinder-capability-gate__fallback"
            onclick={onFallbackAction}
            aria-label="{fallbackAction} for {feature}"
          >
            {fallbackAction}
          </button>
        {/if}

        {#if dismissAction}
          <button
            bind:this={dismissButton}
            type="button"
            class="cinder-capability-gate__dismiss"
            onclick={handleDismiss}
            aria-label={dismissAction}
          >
            {dismissAction}
          </button>
        {/if}
      </div>
    {/if}
  </div>
{/if}
