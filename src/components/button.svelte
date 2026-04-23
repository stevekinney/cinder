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
  // `WithLabel`. The dev-mode guard in the instance script catches that case.
  type WithLabel = { label: string; children?: Snippet };
  type WithChildren = { label?: string; children: Snippet };
  type SharedProps = SharedBase & (WithLabel | WithChildren);

  type ButtonOnlyProps = SharedProps & Omit<HTMLButtonAttributes, 'class'> & { href?: undefined };
  type LinkButtonProps = SharedProps & Omit<HTMLAnchorAttributes, 'class'> & { href: string };

  /** Props for the Button component. */
  export type ButtonProps = ButtonOnlyProps | LinkButtonProps;
</script>

<script lang="ts">
  import { DEV } from 'esm-env';

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

  // Prop-derived values must use `$derived` so they update when the consumer flips a prop
  // (most importantly `loading`) after the initial render.
  const mergedClassName = $derived(classNames('cinder-button', customClassName));
  const dataAttributes = $derived({
    'data-cinder-variant': variant,
    'data-cinder-size': size,
    'data-cinder-full-width': fullWidth ? '' : undefined,
    'data-cinder-loading': loading ? '' : undefined,
  });

  // When loading, force aria-disabled/aria-busy to 'true' so assistive tech always hears the
  // loading state. When not loading, preserve whatever the consumer passed so the component
  // doesn't silently erase their intent.
  const resolvedAriaDisabled = $derived(loading ? 'true' : consumerAriaDisabled);
  const resolvedAriaBusy = $derived(loading ? 'true' : consumerAriaBusy);

  // `rest` is typed as the union of both branches' attribute sets minus the keys we
  // destructured. TypeScript can't narrow a destructured remainder per branch, so each
  // template arm casts `rest` to the attribute shape its element actually accepts. The cast
  // is safe because the `#if href !== undefined` discriminant has already chosen the branch.
  // These stay as plain `const` casts (not `$derived`) because they're type-level renames —
  // the underlying `rest` object is itself reactive, so consumers see prop changes flow through.
  const anchorAttributes = rest as Omit<
    HTMLAnchorAttributes,
    'class' | 'href' | 'tabindex' | 'onclick' | 'aria-disabled' | 'aria-busy'
  >;
  const buttonAttributes = rest as Omit<
    HTMLButtonAttributes,
    'class' | 'type' | 'disabled' | 'onclick' | 'aria-disabled' | 'aria-busy'
  >;

  // Branch-specific prop reads still need `$derived` because `loading` prop flips must
  // propagate to `disabled` / `tabindex` attributes.
  const anchorTabIndex = $derived(
    (rest as { tabindex?: HTMLAnchorAttributes['tabindex'] }).tabindex,
  );
  const buttonType = $derived((rest as { type?: HTMLButtonAttributes['type'] }).type);
  const buttonDisabled = $derived((rest as { disabled?: boolean }).disabled ?? false);

  type ButtonOrAnchorClickHandler = (
    event: MouseEvent & {
      currentTarget: EventTarget & (HTMLButtonElement | HTMLAnchorElement);
    },
  ) => void;

  /**
   * Wrap the consumer's onclick so it doesn't fire during loading. `preventDefault()` blocks
   * the browser's default navigation on anchor left-clicks; stripping `href` in the template
   * handles middle-click / Ctrl-click new-tab paths. Not calling `stopPropagation()` on
   * purpose — unrelated ancestor handlers (analytics, form listeners) should still see the
   * event; only the consumer's own button handler is skipped.
   */
  function handleClick(
    event: MouseEvent & {
      currentTarget: EventTarget & (HTMLButtonElement | HTMLAnchorElement);
    },
  ): void {
    if (loading) {
      event.preventDefault();
      return;
    }
    if (typeof consumerOnClick === 'function') {
      (consumerOnClick as ButtonOrAnchorClickHandler)(event);
    }
  }

  // Dev-mode guard: TypeScript's `label: string` lets `""` through. Warn when the button
  // would render without an accessible name so the bug surfaces in local dev. `DEV` from
  // `esm-env` is a bundler-replaced constant: `true` in dev builds, `false` in prod — so
  // the whole branch is tree-shaken in production. Safe in Vite, SvelteKit, Bun, and Node.
  if (DEV) {
    const hasLabel = typeof label === 'string' && label.trim().length > 0;
    const hasChildren = Boolean(children);
    if (!hasLabel && !hasChildren) {
      console.warn(
        '[cinder/Button] rendered without an accessible name — pass a non-empty `label` or `children`.',
      );
    }
  }
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
