<script lang="ts" module>
  /**
   * @cinder
   * @category feedback
   * @status stable
   * @purpose Page-level dismissible region landmark that surfaces a persistent informational, success, warning, or danger message.
   * @tag feedback
   * @tag notice
   * @useWhen Communicating a persistent page-level status the user can dismiss, such as a maintenance window or trial expiry.
   * @useWhen Pinning a non-urgent message above page content that should remain readable until acknowledged.
   * @avoidWhen Announcing an urgent, time-sensitive message — use alert so assistive tech reads it immediately.
   * @avoidWhen Highlighting an inline aside next to related prose — use callout instead.
   * @related alert, callout, toast-region
   */
  const VARIANT_LABEL = {
    info: 'Information',
    success: 'Success',
    warning: 'Warning',
    danger: 'Error',
  } as const;

  export type { BannerProps, BannerVariant } from './banner.types.ts';
</script>

<script lang="ts">
  import type { BannerProps } from './banner.types.ts';
  import { tick } from 'svelte';
  import { classNames } from '../../utilities/class-names.ts';

  const FOCUSABLE_SELECTOR =
    'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  let {
    variant = 'info',
    dismissible = true,
    onDismiss,
    class: className,
    children,
    actions,
    ...rest
  }: BannerProps = $props();

  let visible = $state(true);
  let rootElement: HTMLDivElement | undefined = $state();

  async function handleDismiss() {
    if (!visible) return;
    const focusTarget = rootElement ? resolveFocusTarget(rootElement) : null;
    visible = false;
    await tick();
    if (focusTarget?.isConnected) focusTarget.focus();
    onDismiss?.();
  }

  function resolveFocusTarget(bannerElement: HTMLElement): HTMLElement | null {
    const bannerDocument = bannerElement.ownerDocument;
    const activeElement = bannerDocument.activeElement;
    if (!(activeElement instanceof HTMLElement) || !bannerElement.contains(activeElement)) {
      return null;
    }
    return findFocusTarget(bannerElement, bannerDocument, activeElement);
  }

  function findFocusTarget(
    bannerElement: HTMLElement,
    bannerDocument: Document,
    activeElement: HTMLElement,
  ): HTMLElement {
    const candidates = Array.from(
      bannerDocument.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    ).filter(
      (element) =>
        element !== activeElement &&
        !bannerElement.contains(element) &&
        !element.hidden &&
        element.getAttribute('aria-hidden') !== 'true' &&
        !element.closest('[hidden], [inert], [aria-hidden="true"]'),
    );

    const next = candidates.find((element) =>
      Boolean(bannerElement.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING),
    );
    const previous = candidates.findLast((element) =>
      Boolean(bannerElement.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_PRECEDING),
    );

    return next ?? previous ?? bannerDocument.body;
  }

  // Strip live-region attributes from rest so a consumer cannot turn a
  // persistent landmark banner back into an assertive announcement (which
  // would defeat the role="region" design — see banner.a11y.md). `aria-busy`
  // is intentionally NOT stripped: it is a status flag, not a live-region
  // attribute, and is valid on `role="region"` to signal that banner
  // content is updating.
  const restWithoutLiveRegion = $derived.by(() => {
    const {
      'aria-live': _ariaLive,
      'aria-atomic': _ariaAtomic,
      'aria-relevant': _ariaRelevant,
      ...filtered
    } = rest;
    return filtered;
  });

  const ariaLabel = $derived(
    rest['aria-labelledby'] ? undefined : (rest['aria-label'] ?? VARIANT_LABEL[variant]),
  );
</script>

{#if visible}
  <div
    bind:this={rootElement}
    {...restWithoutLiveRegion}
    class={classNames(
      'cinder-banner',
      'cinder-_status-surface',
      'cinder-_status-surface-border',
      className,
    )}
    data-cinder-variant={variant}
    role="region"
    aria-label={ariaLabel}
  >
    <div class="cinder-banner__content">
      {@render children()}
    </div>

    {#if actions}
      <div class="cinder-banner__actions">
        {@render actions()}
      </div>
    {/if}

    {#if dismissible}
      <button
        type="button"
        class="cinder-_dismiss-button cinder-banner__dismiss"
        onclick={handleDismiss}
        aria-label="Dismiss banner"
      >
        <svg
          class="cinder-banner__dismiss-icon"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"
          />
        </svg>
      </button>
    {/if}
  </div>
{/if}
