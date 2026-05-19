<script lang="ts" module>
  import type { Snippet } from 'svelte';
  import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';

  /**
   * Visual style of the button.
   *
   * `secondary` is an outline-style button (filled surface + border). It is kept as `secondary`
   * rather than `outline` because: (a) today's `secondary` is already outline-flavored, (b) `ghost`
   * covers the transparent-background case, and (c) 27+ call sites depend on `secondary` today.
   *
   * `soft` / `soft-danger` use a tinted fill with no border — mid-emphasis between `ghost` and
   * `primary`/`danger`. Background is `color-mix(in oklch, accent, transparent 88%)` so it
   * resolves against the current theme's accent/danger color in both light and dark modes.
   */
  export type ButtonVariant =
    | 'primary'
    | 'secondary'
    | 'soft'
    | 'danger'
    | 'soft-danger'
    | 'ghost'
    | 'ghost-danger';

  /** Size of the button. All sizes use compact visual heights; see button.a11y.md for touch-target guidance. */
  export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

  type SharedBase = {
    /** Visual style. */
    variant?: ButtonVariant;
    /** Size of the button. */
    size?: ButtonSize;
    /** Expand to container width. */
    fullWidth?: boolean;
    /** Disable the button and show a spinner. */
    loading?: boolean;
    /** DECORATIVE icon rendered before the label/children. Always wrapped in aria-hidden.
     *  If the icon conveys meaning, supply accessible text via `label`/`aria-label` instead. */
    leadingIcon?: Snippet;
    /** DECORATIVE icon rendered after the label/children. Always wrapped in aria-hidden.
     *  Same accessible-name guidance as `leadingIcon`. */
    trailingIcon?: Snippet;
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
  //
  // `iconOnly` lives only in the union branches (not SharedBase) so the discriminant is real:
  // `WithChildren` genuinely forbids `iconOnly={true}`, and `WithIconOnly` requires it.
  type WithLabel = { label: string; children?: Snippet; iconOnly?: false };
  type WithChildren = { label?: string; children: Snippet; iconOnly?: false };
  type IconOnlyAccessibleName =
    | { label: string; 'aria-label'?: string; 'aria-labelledby'?: string }
    | { label?: string; 'aria-label': string; 'aria-labelledby'?: string }
    | { label?: string; 'aria-label'?: string; 'aria-labelledby': string };
  type IconOnlyVisual =
    | { children: Snippet; leadingIcon?: Snippet; trailingIcon?: Snippet }
    | { children?: Snippet; leadingIcon: Snippet; trailingIcon?: Snippet }
    | { children?: Snippet; leadingIcon?: Snippet; trailingIcon: Snippet };
  // Icon-only buttons require a name source and a visual icon source at compile time.
  // `children` is accepted as the visual icon only; it is not a name source in this mode.
  type WithIconOnly = { iconOnly: true } & IconOnlyAccessibleName & IconOnlyVisual;
  type SharedProps = SharedBase & (WithLabel | WithChildren | WithIconOnly);

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
    iconOnly = false,
    leadingIcon,
    trailingIcon,
    children,
    label,
    class: customClassName,
    href,
    onclick: consumerOnClick,
    'aria-disabled': consumerAriaDisabled,
    'aria-busy': consumerAriaBusy,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
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
    'data-cinder-icon-only': iconOnly ? '' : undefined,
  });

  // When loading, force aria-disabled/aria-busy to 'true' so assistive tech always hears the
  // loading state. When not loading, preserve whatever the consumer passed so the component
  // doesn't silently erase their intent.
  const resolvedAriaDisabled = $derived(loading ? 'true' : consumerAriaDisabled);
  const resolvedAriaBusy = $derived(loading ? 'true' : consumerAriaBusy);

  // Normalize ARIA label props: an empty string `aria-label=""` suppresses text-content fallback
  // in the accessible-name computation (ARIA spec §4.3) without providing a name. Convert empty
  // strings to `undefined` so the DOM attribute is omitted and the fallback (sr-only label text,
  // or button text content) remains the accessible name. Guards and sr-only suppression use the
  // normalized values for consistency.
  const resolvedAriaLabel = $derived(
    typeof ariaLabel === 'string' && ariaLabel.trim().length > 0 ? ariaLabel : undefined,
  );
  const resolvedAriaLabelledBy = $derived(
    typeof ariaLabelledBy === 'string' && ariaLabelledBy.trim().length > 0
      ? ariaLabelledBy
      : undefined,
  );

  // `rest` is typed as the union of both branches' attribute sets minus the keys we
  // destructured. TypeScript can't narrow a destructured remainder per branch, so each
  // template arm casts `rest` to the attribute shape its element actually accepts. The cast
  // is safe because the `#if href !== undefined` discriminant has already chosen the branch.
  // These stay as plain `const` casts (not `$derived`) because they're type-level renames —
  // the underlying `rest` object is itself reactive, so consumers see prop changes flow through.
  const anchorAttributes = rest as Omit<
    HTMLAnchorAttributes,
    | 'class'
    | 'href'
    | 'tabindex'
    | 'onclick'
    | 'aria-disabled'
    | 'aria-busy'
    | 'aria-label'
    | 'aria-labelledby'
  >;
  const buttonAttributes = rest as Omit<
    HTMLButtonAttributes,
    | 'class'
    | 'type'
    | 'disabled'
    | 'onclick'
    | 'aria-disabled'
    | 'aria-busy'
    | 'aria-label'
    | 'aria-labelledby'
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

  // Dev-mode guards. DEV from esm-env is a bundler-replaced constant: true in dev, false in
  // prod — the whole $effect body is tree-shaken in production. Guards run reactively so prop
  // changes after mount also surface issues.
  $effect(() => {
    if (!DEV) return;

    // Guard 1 — Updated baseline: warn when the button has no accessible name at all.
    // Use the normalized resolved values so an empty aria-label="" doesn't falsely satisfy the check.
    const hasLabel = typeof label === 'string' && label.trim().length > 0;
    const hasChildren = Boolean(children);
    const hasAriaLabel = resolvedAriaLabel !== undefined;
    const hasAriaLabelledBy = resolvedAriaLabelledBy !== undefined;
    if (!hasLabel && !hasChildren && !hasAriaLabel && !hasAriaLabelledBy) {
      console.warn(
        '[cinder/Button] rendered without an accessible name — pass a non-empty `label`, `children`, `aria-label`, or `aria-labelledby`.',
      );
    }

    // Guard 2 — icon-only accessible name: children alone does not count because it may be a
    // non-text SVG. Requires aria-label, aria-labelledby, or a non-empty label string.
    if (iconOnly && !hasAriaLabel && !hasAriaLabelledBy && !hasLabel) {
      console.warn(
        '[cinder/Button] iconOnly=true requires aria-label, aria-labelledby, or a non-empty label.',
      );
    }

    // Guard 3 — icon-only visual: a blank square is a real UI failure, not just an a11y issue.
    if (iconOnly && !leadingIcon && !trailingIcon && !children) {
      console.warn(
        '[cinder/Button] iconOnly=true requires a visible icon — pass leadingIcon, trailingIcon, or children.',
      );
    }
  });
</script>

{#snippet buttonContent()}
  {#if leadingIcon}
    <span class="cinder-button__icon" aria-hidden="true">{@render leadingIcon()}</span>
  {/if}
  {#if iconOnly}
    {#if !resolvedAriaLabel && !resolvedAriaLabelledBy && label}
      <span class="cinder-sr-only">{label}</span>
    {/if}
    {#if children}
      <span class="cinder-button__icon" aria-hidden="true">{@render children()}</span>
    {/if}
  {:else if children}
    {@render children()}
  {:else}
    {label}
  {/if}
  {#if trailingIcon}
    <span class="cinder-button__icon" aria-hidden="true">{@render trailingIcon()}</span>
  {/if}
{/snippet}

{#if href !== undefined}
  <a
    {...anchorAttributes}
    href={loading ? undefined : href}
    tabindex={loading ? -1 : anchorTabIndex}
    class={mergedClassName}
    {...dataAttributes}
    aria-disabled={resolvedAriaDisabled}
    aria-busy={resolvedAriaBusy}
    aria-label={resolvedAriaLabel}
    aria-labelledby={resolvedAriaLabelledBy}
    onclick={handleClick}
  >
    {@render buttonContent()}
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
    aria-label={resolvedAriaLabel}
    aria-labelledby={resolvedAriaLabelledBy}
    onclick={handleClick}
  >
    {@render buttonContent()}
  </button>
{/if}
