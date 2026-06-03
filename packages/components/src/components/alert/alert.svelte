<script lang="ts" module>
  /**
   * @cinder
   * @category feedback
   * @status stable
   * @purpose Inline status message with assertive role for surfacing time-sensitive feedback about a nearby action or region.
   * @tag feedback
   * @tag notice
   * @useWhen Surfacing the result of a just-completed action such as a save failure or success.
   * @useWhen Calling out a transient condition the user must notice immediately within a specific region.
   * @avoidWhen Communicating a page- or app-wide notice that persists across views — use a banner instead.
   * @avoidWhen Providing supplemental commentary or guidance inline with content — use a callout instead.
   * @related banner, callout, toast-region
   */
  export type { AlertProps, AlertVariant } from './alert.types.ts';
</script>

<script lang="ts">
  import type { HTMLAttributes } from 'svelte/elements';
  import { tick } from 'svelte';

  import { cn } from '../../utilities/class-names.ts';
  import type { AlertProps } from './alert.types.ts';

  const FOCUSABLE_SELECTOR =
    'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  let {
    variant = 'info',
    dismissible = false,
    onDismiss,
    class: className,
    children,
    icon,
    ...rest
  }: AlertProps = $props();

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

  function resolveFocusTarget(alertElement: HTMLElement): HTMLElement | null {
    const alertDocument = alertElement.ownerDocument;
    const activeElement = alertDocument.activeElement;
    if (!(activeElement instanceof HTMLElement) || !alertElement.contains(activeElement)) {
      return null;
    }
    return findFocusTarget(alertElement, alertDocument, activeElement);
  }

  function findFocusTarget(
    alertElement: HTMLElement,
    alertDocument: Document,
    activeElement: HTMLElement,
  ): HTMLElement {
    const candidates = Array.from(
      alertDocument.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    ).filter(
      (element) =>
        element !== activeElement &&
        !alertElement.contains(element) &&
        !element.hidden &&
        element.getAttribute('aria-hidden') !== 'true' &&
        !element.closest('[hidden], [inert], [aria-hidden="true"]'),
    );

    const next = candidates.find((element) =>
      Boolean(alertElement.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING),
    );
    const previous = candidates.findLast((element) =>
      Boolean(alertElement.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_PRECEDING),
    );

    return next ?? previous ?? alertDocument.body;
  }

  // P6-C2 locks Alert as the live-region notification: `role="alert"` is
  // non-overridable and must never downgrade to `role="status"`. Scrub role,
  // aria-live (would fight the implicit assertive), aria-atomic (ARIA spec
  // implies true for role=alert; a consumer false would override the implicit),
  // and aria-relevant (modifies announcement behavior) from rest, then spread
  // the filtered rest BEFORE the locked `role="alert"` so the hardcoded value
  // always wins the cascade. Mirrors banner.svelte / callout.svelte defense.
  const restWithoutForbidden = $derived.by(() => {
    const {
      role: _role,
      'aria-live': _ariaLive,
      'aria-atomic': _ariaAtomic,
      'aria-relevant': _ariaRelevant,
      ...filtered
    } = rest as HTMLAttributes<HTMLDivElement> & Record<string, unknown>;
    return filtered;
  });
</script>

{#if visible}
  <div
    bind:this={rootElement}
    {...restWithoutForbidden}
    class={cn('cinder-alert', 'cinder-_status-surface', className)}
    data-cinder-variant={variant}
    role="alert"
  >
    {#if icon}
      <div class="cinder-alert__icon" aria-hidden="true">
        {@render icon()}
      </div>
    {/if}

    <div class="cinder-alert__content">
      {@render children()}
    </div>

    {#if dismissible}
      <button
        type="button"
        class="cinder-_dismiss-button cinder-alert__dismiss"
        onclick={handleDismiss}
        aria-label="Dismiss alert"
      >
        <svg
          class="cinder-alert__dismiss-icon"
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
