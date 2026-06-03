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
    FloatingActionButtonSize,
    FloatingActionButtonVariant,
    FloatingActionButtonColor,
  } from './floating-action-button.types.ts';
</script>

<script lang="ts">
  import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';

  import { classNames } from '../../utilities/class-names.ts';
  import { devWarn } from '../../utilities/dev-warn.ts';
  import type { FloatingActionButtonProps } from './floating-action-button.types.ts';

  const {
    variant = 'filled',
    size = 'md',
    color = 'primary',
    disabled = false,
    children,
    class: customClassName,
    href,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    ...rest
  }: FloatingActionButtonProps = $props();

  const mergedClassName = $derived(classNames('cinder-fab', customClassName));

  const dataAttributes = $derived({
    'data-cinder-variant': variant,
    'data-cinder-size': size,
    'data-cinder-color': color,
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
    rest as Omit<HTMLAnchorAttributes, 'class' | 'href' | 'aria-label' | 'aria-labelledby'>,
  );
  const buttonAttributes = $derived(
    rest as Omit<
      HTMLButtonAttributes,
      'class' | 'type' | 'disabled' | 'aria-label' | 'aria-labelledby'
    >,
  );

  // Dev-mode guards. devWarn no-ops in production.
  $effect(() => {
    const hasAriaLabel = resolvedAriaLabel !== undefined;
    const hasAriaLabelledBy = resolvedAriaLabelledBy !== undefined;

    // Filled FABs are icon-only by design — they require an accessible name.
    if (variant === 'filled' && !hasAriaLabel && !hasAriaLabelledBy) {
      devWarn(
        '[cinder/FloatingActionButton] filled variant requires aria-label or aria-labelledby — the icon alone does not provide an accessible name.',
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
    tabindex={disabled ? -1 : undefined}
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
  >
    {#if children}
      {@render children()}
    {/if}
  </button>
{/if}
