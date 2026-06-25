<script lang="ts" module>
  /**
   * @cinder
   * @category form
   * @status alpha
   * @purpose Selectable answer tile used inside a ChoiceGrid; carries selected, disabled, correct, incorrect, and pending states without shifting cell dimensions.
   * @tag form
   * @tag selection
   * @tag quiz
   * @useWhen Composing individual answer choices inside a ChoiceGrid parent.
   * @avoidWhen Used outside a ChoiceGrid — this leaf requires the parent context.
   * @related choice-grid
   */
  export type {
    ChoiceGridItemProps,
    ChoiceGridItemState,
  } from '../choice-grid/choice-grid.types.ts';
</script>

<script lang="ts">
  import type { ChoiceGridItemProps } from './choice-grid-item.types.ts';
  import { untrack } from 'svelte';
  import { getChoiceGridContext } from '../choice-grid/choice-grid-context.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import { rovingTabIndex } from '../../_internal/collection.ts';
  import { devWarn } from '../../utilities/dev-warn.ts';

  const ITEM_STATES = ['neutral', 'correct', 'incorrect', 'pending'] as const;

  let {
    value,
    // Renamed off `state` to avoid svelte-check treating the bare identifier as
    // the `$state` rune; the public prop name is still `state`.
    state: stateProp = 'neutral',
    disabled = false,
    class: className,
    children,
  }: ChoiceGridItemProps = $props();

  // Validate the public `state` against the allowed union so a plain-JS or
  // dynamic value can't emit an unsupported `data-cinder-state`. Invalid values
  // fall back to neutral (no data attribute) with a dev warning.
  const feedbackState = $derived(
    (ITEM_STATES as readonly string[]).includes(stateProp) ? stateProp : 'neutral',
  );
  $effect(() => {
    if (!(ITEM_STATES as readonly string[]).includes(stateProp)) {
      devWarn(
        `ChoiceGridItem: invalid state "${String(stateProp)}". Expected one of ${ITEM_STATES.join(', ')}. Falling back to "neutral".`,
      );
    }
  });

  const context = getChoiceGridContext();

  // `value` is the registry key and is fixed for the item's lifetime. Captured
  // via untrack so a runtime mutation does not silently re-key the parent
  // registry. EVERY ChoiceGrid interaction (selection, focusability, click)
  // routes through `registeredValue`, never the live `value` prop, so a changing
  // `value` can't desync the registry key from the selection/focus key. A
  // changing `value` is unsupported and warned in development.
  const registeredValue = untrack(() => value);
  $effect(() => {
    if (value !== registeredValue) {
      devWarn(
        `ChoiceGridItem: \`value\` changed from "${registeredValue}" to "${value}" after mount. ChoiceGridItem.value must be stable — give the item a fixed value (use {#key} to remount if the value must change). The grid keeps using the original value.`,
      );
    }
  });

  const isSelected = $derived(context.isSelected(registeredValue));
  const isDisabled = $derived(disabled || context.disabled);
  const isFocusable = $derived(context.isFocusable(registeredValue));
  const tabIndex = $derived(rovingTabIndex(isFocusable));

  // In single-select mode, the item acts as a radio button (role="radio").
  // In multi-select mode, the item acts as a checkbox (role="checkbox").
  const role = $derived(context.multiple ? 'checkbox' : 'radio');

  let elementRef: HTMLElement | null = $state(null);

  // Effect A — mount/unmount registration. Uses untrack to avoid creating a
  // reactive cycle: register/unregister write to a reactive version counter,
  // reading that inside an effect would self-trigger an infinite loop.
  $effect(() => {
    const el = elementRef;
    if (!el) return;
    untrack(() => {
      context.register(registeredValue, el, isDisabled);
    });
    return () => {
      untrack(() => {
        context.unregister(registeredValue);
      });
    };
  });

  // Effect B — keep the parent's tracked disabled state in sync when this item's
  // effective disabled state changes, so roving navigation and the focusable
  // computation skip it. Reading isDisabled subscribes us; the write is untracked
  // to stay out of the version-counter cycle.
  $effect(() => {
    const nextDisabled = isDisabled;
    untrack(() => {
      context.setItemDisabled(registeredValue, nextDisabled);
    });
  });

  function handleClick(): void {
    if (isDisabled) return;
    context.select(registeredValue);
  }

  function handleKeydown(event: KeyboardEvent): void {
    // Always forward to the parent so arrow/Home/End navigation works even when
    // this tile is disabled (a disabled tile that holds focus must not trap the
    // keyboard). The parent's `select()` already refuses to activate a disabled
    // item, so Space/Enter on a disabled tile is a safe no-op.
    context.handleKeydown(event);
  }
</script>

<div
  bind:this={elementRef}
  {role}
  aria-checked={isSelected}
  aria-disabled={isDisabled || undefined}
  tabindex={tabIndex}
  class={classNames('cinder-choice-grid-item', className)}
  data-cinder-selected={isSelected ? '' : undefined}
  data-cinder-disabled={isDisabled || undefined}
  data-cinder-state={feedbackState !== 'neutral' ? feedbackState : undefined}
  onclick={handleClick}
  onkeydown={handleKeydown}
>
  <span class="cinder-choice-grid-item__content">
    {@render children()}
  </span>
</div>
