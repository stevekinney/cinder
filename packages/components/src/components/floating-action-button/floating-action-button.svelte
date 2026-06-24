<script lang="ts" module>
  /**
   * @cinder
   * @category action
   * @status beta
   * @purpose Circular button representing the single most important action on a screen.
   * @tag action
   * @tag button
   * @useWhen One action dominates the page purpose (compose, add, create).
   * @avoidWhen Multiple equally-important actions exist — use a toolbar or button group.
   * @avoidWhen You need it pinned to the viewport — it doesn't position itself; wrap it in your own fixed/sticky container.
   * @related button, toolbar
   */
  export type {
    FloatingActionButtonProps,
    FloatingActionButtonShape,
    FloatingActionButtonSize,
    FloatingActionButtonVariant,
  } from './floating-action-button.types.ts';
</script>

<script lang="ts">
  import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';

  import { classNames } from '../../utilities/class-names.ts';
  import { devWarn } from '../../utilities/dev-warn.ts';
  import type { FloatingActionButtonProps } from './floating-action-button.types.ts';

  const {
    shape = 'filled',
    size = 'md',
    variant = 'primary',
    disabled = false,
    children,
    class: customClassName,
    href,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    // Pulled out of `rest` so we can control them per disabled-state:
    // - tabindex: a disabled item forces -1, an enabled one honors the consumer value.
    // - onclick: a disabled anchor must not run a consumer handler (pointer-events:none
    //   blocks the mouse, but a handler in `rest` would still fire on keyboard/programmatic
    //   activation). The button arm already blocks both via the native `disabled` attribute.
    tabindex,
    onclick,
    ...rest
  }: FloatingActionButtonProps = $props();

  // Disabled forces -1 (out of the tab order); otherwise the consumer value (or undefined).
  const resolvedTabindex = $derived(disabled ? -1 : tabindex);

  const mergedClassName = $derived(classNames('cinder-fab', customClassName));

  const dataAttributes = $derived({
    'data-cinder-shape': shape,
    'data-cinder-size': size,
    'data-cinder-variant': variant,
  });

  // Normalize ARIA label props: empty strings suppress accessible name fallback without
  // providing a name. Convert empty strings to `undefined` so the attribute is omitted.
  const resolvedAriaLabel = $derived(
    typeof ariaLabel === 'string' && ariaLabel.trim().length > 0 ? ariaLabel : undefined,
  );
  const resolvedAriaLabelledBy = $derived(
    typeof ariaLabelledBy === 'string' && ariaLabelledBy.trim().length > 0
      ? ariaLabelledBy
      : undefined,
  );

  // Typed rest casts: TypeScript cannot narrow a destructured remainder per branch,
  // so each template arm casts `rest` to the attribute shape its element accepts.
  const anchorAttributes = $derived(
    rest as Omit<
      HTMLAnchorAttributes,
      'class' | 'href' | 'aria-label' | 'aria-labelledby' | 'tabindex' | 'onclick'
    >,
  );
  const buttonAttributes = $derived(
    rest as Omit<
      HTMLButtonAttributes,
      'class' | 'type' | 'disabled' | 'aria-label' | 'aria-labelledby' | 'tabindex' | 'onclick'
    >,
  );

  // Dev-mode guards. devWarn no-ops in production.
  $effect(() => {
    const hasAriaLabel = resolvedAriaLabel !== undefined;
    const hasAriaLabelledBy = resolvedAriaLabelledBy !== undefined;

    // Filled FABs are icon-only by design — they require an accessible name.
    if (shape === 'filled' && !hasAriaLabel && !hasAriaLabelledBy) {
      devWarn(
        '[cinder/FloatingActionButton] filled shape requires aria-label or aria-labelledby — the icon alone does not provide an accessible name.',
      );
    }

    // All FABs need some accessible name.
    if (!hasAriaLabel && !hasAriaLabelledBy && !children) {
      devWarn(
        '[cinder/FloatingActionButton] rendered without an accessible name — pass aria-label, aria-labelledby, or children.',
      );
    }
  });
</script>

{#if href !== undefined}
  <!--
    Disabled anchor: the href is withheld and the element is removed from the tab order
    (tabindex=-1) so a "disabled" link cannot actually navigate or be focused — anchors
    have no native `disabled`, and aria-disabled alone is advisory (the link would still
    work). pointer-events:none in the CSS blocks mouse activation. Mirrors Link/NavigationItem.
  -->
  <a
    {...anchorAttributes}
    href={disabled ? undefined : href}
    class={mergedClassName}
    {...dataAttributes}
    aria-label={resolvedAriaLabel}
    aria-labelledby={resolvedAriaLabelledBy}
    aria-disabled={disabled || undefined}
    tabindex={resolvedTabindex}
    onclick={disabled ? undefined : onclick}
  >
    {#if children}
      {@render children()}
    {/if}
  </a>
{:else}
  <button
    {...buttonAttributes}
    type="button"
    class={mergedClassName}
    {...dataAttributes}
    {disabled}
    aria-label={resolvedAriaLabel}
    aria-labelledby={resolvedAriaLabelledBy}
    tabindex={resolvedTabindex}
    {onclick}
  >
    {#if children}
      {@render children()}
    {/if}
  </button>
{/if}
