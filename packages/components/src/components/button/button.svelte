<script lang="ts" module>
  /**
   * @cinder
   * @category action
   * @status stable
   * @purpose Primary interactive control for triggering actions or rendering an anchor styled as a button via href.
   * @tag action
   * @tag cta
   * @useWhen Triggering a discrete action such as submit, save, or delete.
   * @useWhen Rendering a link that should look and behave like a button by passing href.
   * @avoidWhen Toggling a binary on or off state — use toggle instead.
   * @avoidWhen Selecting one of a small fixed set of options — use segmented-control instead.
   * @related button-group, copy-button
   */
  export type { ButtonProps, ButtonSize, ButtonVariant } from './button.types.ts';
</script>

<script lang="ts">
  import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';

  import { classNames } from '../../utilities/class-names.ts';
  import { devWarn } from '../../utilities/dev-warn.ts';
  import type { ButtonProps } from './button.types.ts';

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
  // These are plain `const` casts — `rest` from `$props()` is already reactive, so the
  // template spread re-reads consumer prop changes without an intermediate `$derived` node.
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

  // Branch-specific prop reads stay `$derived` because they extract a *value* off `rest`
  // (a property access snapshots, unlike the spread of `rest` itself which re-reads the
  // reactive proxy). Keeping these derived ensures consumer `tabindex` / `type` / `disabled`
  // changes after mount still propagate to the rendered attributes.
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

  // Dev-mode guards. devWarn no-ops in production (bundler DCE strips the call when DEV=false).
  // Guards run reactively so prop changes after mount also surface issues.
  $effect(() => {
    // Guard 1 — Updated baseline: warn when the button has no accessible name at all.
    // Use the normalized resolved values so an empty aria-label="" doesn't falsely satisfy the check.
    const hasLabel = typeof label === 'string' && label.trim().length > 0;
    const hasChildren = Boolean(children);
    const hasAriaLabel = resolvedAriaLabel !== undefined;
    const hasAriaLabelledBy = resolvedAriaLabelledBy !== undefined;
    if (!hasLabel && !hasChildren && !hasAriaLabel && !hasAriaLabelledBy) {
      devWarn(
        '[cinder/Button] rendered without an accessible name — pass a non-empty `label`, `children`, `aria-label`, or `aria-labelledby`.',
      );
    }

    // Guard 2 — icon-only accessible name: children alone does not count because it may be a
    // non-text SVG. Requires aria-label, aria-labelledby, or a non-empty label string.
    if (iconOnly && !hasAriaLabel && !hasAriaLabelledBy && !hasLabel) {
      devWarn(
        '[cinder/Button] iconOnly=true requires aria-label, aria-labelledby, or a non-empty label.',
      );
    }

    // Guard 3 — icon-only visual: a blank square is a real UI failure, not just an a11y issue.
    if (iconOnly && !leadingIcon && !trailingIcon && !children) {
      devWarn(
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
    role={loading ? 'link' : undefined}
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
