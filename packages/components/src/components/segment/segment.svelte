<script lang="ts" module>
  /**
   * @cinder
   * @category form
   * @status stable
   * @purpose Individual option inside a SegmentedControl that renders either a selection button or a route-backed link with shared segmented styling.
   * @tag form
   * @tag selection
   * @useWhen Authoring SegmentedControl children declaratively so consumers can compose icons, labels, and badges per segment.
   * @useWhen Mixing disabled and enabled segments inside a single radiogroup/tablist where each segment carries its own metadata.
   * @useWhen Rendering route filters as real links inside `SegmentedControl variant="navigation"`.
   * @avoidWhen Building a standalone toggle button — use Button or Toggle instead.
   * @avoidWhen Selecting one option from a long list — use Select or Combobox instead.
   * @related segmented-control, button, toggle
   */
  export type { SegmentProps } from './segment.types.ts';
</script>

<script lang="ts">
  import { untrack } from 'svelte';
  import type { Attachment } from 'svelte/attachments';
  import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';

  import { classNames } from '../../utilities/class-names.ts';
  import { getSegmentedControlContext } from '../segmented-control/segmented-control-state.svelte.ts';
  import type { SegmentProps } from './segment.types.ts';

  let {
    value,
    href,
    current = false,
    currentToken = 'page',
    disabled = false,
    controls,
    leading,
    trailing,
    children,
    class: customClassName,
    onclick,
    ...rest
  }: SegmentProps = $props();

  const context = getSegmentedControlContext();

  const buttonValue = $derived(value ?? '');

  const registerSegment: Attachment<HTMLButtonElement> = (node) => {
    // Attachments run inside a tracked effect. Wrap the call to register() in
    // `untrack` so the controller's mutation of its internal state does not
    // re-arm this attachment, which would otherwise unregister + re-register
    // on every render and starve the reactivity graph. The registration
    // object exposes props via getters so prop changes flow live to consumers
    // without needing to re-register.
    return untrack(() =>
      context.register({
        node,
        get value() {
          return buttonValue;
        },
        get disabled() {
          return disabled || context.controlDisabled;
        },
        get controls() {
          return controls;
        },
      }),
    );
  };

  const isSelected = $derived(context.isSelected(buttonValue));
  const isFocusable = $derived(context.isFocusable(buttonValue));
  const effectiveDisabled = $derived(disabled || context.controlDisabled);
  const isNavigationItem = $derived(context.variant === 'navigation');
  const anchorDisabled = $derived(effectiveDisabled || href === undefined);
  const anchorAttributes = $derived(rest as Omit<HTMLAnchorAttributes, 'class' | 'href'>);
  const buttonAttributes = $derived(rest as Omit<HTMLButtonAttributes, 'class'>);

  const role = $derived(
    context.selectionMode === 'multiple'
      ? undefined
      : context.variant === 'tablist'
        ? 'tab'
        : 'radio',
  );

  function handleAnchorClick(event: MouseEvent): void {
    if (anchorDisabled) {
      event.preventDefault();
      return;
    }
    (onclick as ((event: MouseEvent) => void) | undefined)?.(event);
  }
</script>

{#snippet content()}
  {#if leading}
    <span class="cinder-segmented-control-option-icon" aria-hidden="true">
      {@render leading()}
    </span>
  {/if}
  <!-- children: Snippet is required in TypeScript but the optional-chain is a
     JS-caller safety net. Segment requires SegmentedControl's group context to
     render so it can't be tested standalone; the guard is verified at code level. -->
  {@render children?.()}
  {#if trailing}
    <span class="cinder-segmented-control-option-trailing" aria-hidden="true">
      {@render trailing()}
    </span>
  {/if}
{/snippet}

{#if isNavigationItem}
  <a
    {...anchorAttributes}
    href={anchorDisabled ? undefined : href}
    data-cinder-segment-value={value}
    aria-current={current ? currentToken : undefined}
    aria-disabled={anchorDisabled ? 'true' : undefined}
    class={classNames('cinder-segmented-control-option', customClassName)}
    data-cinder-current={current ? '' : undefined}
    onclick={handleAnchorClick}
  >
    {@render content()}
  </a>
{:else}
  <button
    {...buttonAttributes}
    type="button"
    {role}
    data-cinder-segment-value={buttonValue}
    aria-checked={role === 'radio' ? isSelected : undefined}
    aria-selected={role === 'tab' ? isSelected : undefined}
    aria-pressed={context.selectionMode === 'multiple' ? isSelected : undefined}
    aria-controls={role === 'tab' ? controls : undefined}
    aria-disabled={effectiveDisabled ? 'true' : undefined}
    disabled={context.selectionMode === 'multiple' ? effectiveDisabled : undefined}
    tabindex={isFocusable ? 0 : -1}
    class={classNames('cinder-segmented-control-option', customClassName)}
    data-cinder-selected={isSelected ? '' : undefined}
    data-cinder-pressed={context.selectionMode === 'multiple' && isSelected ? '' : undefined}
    onclick={() => context.toggle(buttonValue)}
    {@attach registerSegment}
  >
    {@render content()}
  </button>
{/if}
