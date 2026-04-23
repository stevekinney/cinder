<script lang="ts" module>
  import type { Snippet } from 'svelte';
  import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';

  /** Visual style of the button. */
  export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

  /** Size of the button. */
  export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

  type SharedBase = {
    /** Visual style. */
    variant?: ButtonVariant;
    /** Size of the button. */
    size?: ButtonSize;
    /** Expand to container width. */
    fullWidth?: boolean;
    /** Disable the button and show a spinner. */
    loading?: boolean;
    /** Custom class merged with `.cinder-button`. */
    class?: string;
  };

  // At least one of `label` or `children` must be provided so the button has an accessible name.
  //
  // The union shape (rather than `label?: string; children?: Snippet`) gives TypeScript a
  // compile-time guarantee that a consumer can't write `<Button />` with neither. The Phase 4
  // analyzer reads this two-variant shape to generate correct prop-control UI for each branch.
  // Runtime limitation: `string` includes `""`, so a literal empty label still satisfies
  // `WithLabel`. The dev-mode `$effect` below catches that case.
  type WithLabel = { label: string; children?: Snippet };
  type WithChildren = { label?: string; children: Snippet };
  type SharedProps = SharedBase & (WithLabel | WithChildren);

  type ButtonOnlyProps = SharedProps & Omit<HTMLButtonAttributes, 'class'> & { href?: undefined };
  type LinkButtonProps = SharedProps & Omit<HTMLAnchorAttributes, 'class'> & { href: string };

  /** Props for the Button component. */
  export type ButtonProps = ButtonOnlyProps | LinkButtonProps;
</script>

<script lang="ts">
  import { classNames } from '../utilities/class-names.ts';

  // Destructured props let the Phase 4 analyzer read names + defaults straight off the AST.
  // `...rest` carries the remaining native HTML attributes through to the underlying element.
  //
  // ARIA + onclick are destructured explicitly because:
  //  - Leaving them in `rest` would cause Svelte's spread to render our internally-computed
  //    values LAST, clobbering any consumer-provided aria-disabled / aria-busy. Destructuring
  //    gives us control of the resolved value per attribute.
  //  - `onclick` must be wrapped during `loading` so the consumer handler doesn't fire — just
  //    stripping `href` blocks navigation but the click event still bubbles.
  const {
    variant = 'secondary',
    size = 'md',
    fullWidth = false,
    loading = false,
    children,
    label,
    class: customClassName,
    href,
    onclick: consumerOnClick,
    'aria-disabled': consumerAriaDisabled,
    'aria-busy': consumerAriaBusy,
    ...rest
  }: ButtonProps = $props();

  const mergedClassName = classNames('cinder-button', customClassName);
  const dataAttributes = {
    'data-cinder-variant': variant,
    'data-cinder-size': size,
    'data-cinder-full-width': fullWidth ? '' : undefined,
    'data-cinder-loading': loading ? '' : undefined,
  };

  // When loading, we force aria-disabled/aria-busy to 'true' so assistive tech always hears
  // the loading state. When not loading, we preserve whatever the consumer passed (which may
  // be 'true', 'false', or undefined) so the component doesn't silently erase their intent.
  const resolvedAriaDisabled = loading ? 'true' : consumerAriaDisabled;
  const resolvedAriaBusy = loading ? 'true' : consumerAriaBusy;

  // `rest` is typed as the union of both branches' attribute sets minus the keys we
  // destructured. TypeScript can't narrow a destructured remainder per branch, so each
  // template arm casts `rest` to the attribute shape its element actually accepts. The cast
  // is safe because the `#if href !== undefined` discriminant has already chosen the branch.
  const anchorAttributes: Omit<
    HTMLAnchorAttributes,
    'class' | 'href' | 'tabindex' | 'onclick' | 'aria-disabled' | 'aria-busy'
  > = rest as Omit<
    HTMLAnchorAttributes,
    'class' | 'href' | 'tabindex' | 'onclick' | 'aria-disabled' | 'aria-busy'
  >;
  const buttonAttributes: Omit<
    HTMLButtonAttributes,
    'class' | 'type' | 'disabled' | 'onclick' | 'aria-disabled' | 'aria-busy'
  > = rest as Omit<
    HTMLButtonAttributes,
    'class' | 'type' | 'disabled' | 'onclick' | 'aria-disabled' | 'aria-busy'
  >;

  const anchorTabIndex = (rest as { tabindex?: HTMLAnchorAttributes['tabindex'] }).tabindex;
  const buttonType = (rest as { type?: HTMLButtonAttributes['type'] }).type;
  const buttonDisabled = (rest as { disabled?: boolean }).disabled ?? false;

  /**
   * Wrap the consumer's onclick so it doesn't fire during loading. Prevents default too so
   * an anchor with a stale href still in the DOM tree (during the render tick before
   * `loading` propagates) can't follow the link. Event type is `MouseEvent` here; Svelte's
   * element binding will refine `currentTarget` per element when this handler is attached.
   */
  function handleClick(event: MouseEvent): void {
    if (loading) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    // The consumer's handler was typed against HTMLButtonElement or HTMLAnchorElement at the
    // call site; at this point we don't have the branch-specific type, so forward the event
    // as-is. TypeScript's discriminated-union narrowing can't reach this handler body.
    if (typeof consumerOnClick === 'function') {
      (consumerOnClick as (event: MouseEvent) => void)(event);
    }
  }

  // Dev-mode guard: TypeScript's `label: string` lets `""` through. Warn once when the button
  // would render without an accessible name so the bug surfaces in local dev before prod.
  $effect(() => {
    if (Bun.env.NODE_ENV === 'production') return;
    const hasLabel = typeof label === 'string' && label.trim().length > 0;
    const hasChildren = Boolean(children);
    if (!hasLabel && !hasChildren) {
      // eslint-disable-next-line no-console
      console.warn(
        '[cinder/Button] rendered without an accessible name — pass a non-empty `label` or `children`.',
      );
    }
  });
</script>

{#if href !== undefined}
  <a
    {...anchorAttributes}
    href={loading ? undefined : href}
    tabindex={loading ? -1 : anchorTabIndex}
    class={mergedClassName}
    {...dataAttributes}
    aria-disabled={resolvedAriaDisabled}
    aria-busy={resolvedAriaBusy}
    onclick={handleClick}
  >
    {#if children}{@render children()}{:else}{label}{/if}
  </a>
{:else}
  <button
    {...buttonAttributes}
    type={buttonType ?? 'button'}
    class={mergedClassName}
    {...dataAttributes}
    disabled={buttonDisabled || loading}
    aria-disabled={resolvedAriaDisabled}
    aria-busy={resolvedAriaBusy}
    onclick={handleClick}
  >
    {#if children}{@render children()}{:else}{label}{/if}
  </button>
{/if}
