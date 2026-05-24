<script lang="ts">
  import { untrack } from 'svelte';

  import { classNames } from '../../utilities/class-names.ts';

  import type { PresenceProps } from './transition.types.ts';
  import { getPresenceExitDuration } from './transition.utilities.ts';

  let {
    present,
    forceMount = false,
    class: className,
    children,
    onExitComplete,
    ...rest
  }: PresenceProps = $props();

  let wrapper: HTMLDivElement | undefined = $state();
  let isMounted = $state(false);
  let visibilityState: 'open' | 'closed' = $state('closed');
  let presenceState: 'entering' | 'entered' | 'exiting' | 'exited' = $state('exited');
  let hasInitialized = false;
  let exitGeneration = 0;
  let exitTimer: ReturnType<typeof setTimeout> | null = null;
  let exitStart = 0;
  let requiredElapsed = 0;

  function clearExitTimer() {
    if (exitTimer) {
      clearTimeout(exitTimer);
      exitTimer = null;
    }
  }

  function completeExit(generation: number) {
    if (generation !== exitGeneration) return;
    clearExitTimer();
    presenceState = 'exited';
    visibilityState = 'closed';
    if (!forceMount) {
      isMounted = false;
    }
    onExitComplete?.();
  }

  function scheduleEntered(generation: number) {
    requestAnimationFrame(() => {
      if (generation !== exitGeneration || !present) return;
      presenceState = 'entered';
      visibilityState = 'open';
    });
  }

  function handleExitEvent(event: TransitionEvent | AnimationEvent) {
    // Defensive: once an exit completes, Svelte may tear the wrapper down to `undefined` before a
    // late bubbling event arrives. `event.target !== undefined` is always true, so without this
    // guard a child's `transitionend` could fall through to `completeExit` and double-fire.
    if (presenceState !== 'exiting') return;
    if (!wrapper || event.target !== wrapper) return;
    if (performance.now() - exitStart < requiredElapsed) return;
    completeExit(exitGeneration);
  }

  $effect.pre(() => {
    if (hasInitialized) return;

    hasInitialized = true;
    isMounted = present || forceMount;
    visibilityState = present ? 'open' : 'closed';
    presenceState = present ? 'entering' : 'exited';
  });

  $effect(() => {
    if (present) {
      exitGeneration += 1;
      clearExitTimer();
      isMounted = true;
      visibilityState = 'open';
      presenceState = 'entering';
      scheduleEntered(exitGeneration);
      return;
    }

    // Read presenceState / isMounted untracked: reading them tracked would make this effect
    // depend on the values we write to *inside* this same branch (`presenceState = 'exiting'`),
    // triggering a wasted second run that invalidates the rAF scheduled below.
    const currentPresenceState = untrack(() => presenceState);
    const currentIsMounted = untrack(() => isMounted);

    // The first run with `present={false}` is the initial render. `forceMount` may have placed the
    // wrapper in the DOM, but the plan requires the initial state to be `closed`/`exited` — not
    // `exiting` followed by an `onExitComplete`. Skip the exit-scheduling branch on first run; the
    // `$effect.pre` block above has already set the correct attributes.
    if (currentPresenceState === 'exited') {
      visibilityState = 'closed';
      return;
    }

    if (!currentIsMounted) {
      presenceState = forceMount ? 'exited' : currentPresenceState;
      visibilityState = 'closed';
      return;
    }

    exitGeneration += 1;
    const generation = exitGeneration;
    visibilityState = 'closed';
    presenceState = 'exiting';

    requestAnimationFrame(() => {
      if (generation !== exitGeneration || !wrapper) return;
      requiredElapsed = getPresenceExitDuration(wrapper);
      exitStart = performance.now();

      if (requiredElapsed === 0) {
        requestAnimationFrame(() => completeExit(generation));
        return;
      }

      exitTimer = setTimeout(() => completeExit(generation), requiredElapsed + 34);
    });
  });
</script>

{#if isMounted || forceMount}
  <div
    bind:this={wrapper}
    class={classNames(className)}
    data-cinder-state={visibilityState}
    data-cinder-presence={presenceState}
    ontransitionend={handleExitEvent}
    onanimationend={handleExitEvent}
    {...rest}
  >
    {@render children()}
  </div>
{/if}
