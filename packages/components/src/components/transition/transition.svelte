<script lang="ts" module>
  /**
   * @cinder
   * @category overlay
   * @status beta
   * @purpose Headless mount-coordination primitives for CSS-driven presence state and Svelte transition functions.
   * @tag overlay
   * @tag motion
   * @useWhen Coordinating enter and exit lifecycle for overlays, floating panels, or other conditional UI.
   * @useWhen Reusing either CSS transition-driven presence or a Svelte transition function behind one small API.
   * @avoidWhen A plain `{#if}` block is sufficient and no enter or exit coordination is needed.
   * @related modal, drawer, sheet, accordion-item
   */
  export type { PresenceProps, TransitionProps } from './transition.types.ts';
</script>

<script lang="ts" generics="TransitionParameters">
  import { classNames } from '../../utilities/class-names.ts';

  import type { TransitionProps } from './transition.types.ts';

  import Presence from './presence.svelte';

  let {
    show,
    children,
    transition: transitionFunction,
    transitionParameters = undefined as TransitionParameters,
    class: className,
    ...rest
  }: TransitionProps<TransitionParameters> = $props();
</script>

{#if transitionFunction}
  {#if show}
    <div
      class={classNames(className)}
      transition:transitionFunction={transitionParameters}
      {...rest}
    >
      {@render children()}
    </div>
  {/if}
{:else}
  <Presence present={show} class={className} {...rest}>
    {@render children()}
  </Presence>
{/if}
