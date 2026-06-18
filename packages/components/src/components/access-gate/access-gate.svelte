<script lang="ts" module>
  /**
   * @cinder
   * @category feedback
   * @status alpha
   * @purpose Authorization-scope gate that keeps unavailable actions visible with an accessible reason or replaces locked sections with a scope-required placeholder.
   * @tag feedback
   * @tag authorization
   * @tag permission
   * @useWhen Showing a mutating action that the current user cannot activate because an application authorization scope is missing.
   * @useWhen Replacing a panel, tab, or administrative section with a lock state that names the missing scope or permission.
   * @avoidWhen Checking browser permissions, media capabilities, or feature support — use capability-gate instead.
   * @avoidWhen Resolving roles, scopes, or policies — compute granted in application code and pass the boolean in.
   * @related capability-gate, button, callout, empty-state
   * @a11yNote Denied inline gates disable native controls, mark custom controls aria-disabled, remove them from sequential focus, and wire the reason through aria-describedby.
   */
  export type { AccessGateProps, AccessGateVariant } from './access-gate.types.ts';
</script>

<script lang="ts">
  import { Lock } from 'lucide-svelte';
  import type { Attachment } from 'svelte/attachments';

  import { classNames } from '../../utilities/class-names.ts';

  import type { AccessGateProps } from './access-gate.types.ts';

  const INTERACTIVE_SELECTOR = [
    'button',
    'input',
    'select',
    'textarea',
    'fieldset',
    'optgroup',
    'option',
    'a[href]',
    '[tabindex]',
    '[role="button"]',
    '[role="checkbox"]',
    '[role="link"]',
    '[role="menuitem"]',
    '[role="menuitemcheckbox"]',
    '[role="menuitemradio"]',
    '[role="option"]',
    '[role="radio"]',
    '[role="switch"]',
  ].join(',');

  type NativeDisableable =
    | HTMLButtonElement
    | HTMLInputElement
    | HTMLSelectElement
    | HTMLTextAreaElement
    | HTMLFieldSetElement
    | HTMLOptGroupElement
    | HTMLOptionElement;

  let {
    granted,
    variant = 'inline',
    reason,
    requirement,
    children,
    class: customClassName,
    ...rest
  }: AccessGateProps = $props();

  const baseId = $props.id();
  const inlineReasonId = `${baseId}-reason`;
  const sectionTitleId = `${baseId}-title`;
  const sectionReasonId = `${baseId}-description`;
  const sectionRequirementId = `${baseId}-requirement`;
  const sectionDescriptionIds = $derived(
    requirement ? `${sectionReasonId} ${sectionRequirementId}` : sectionReasonId,
  );

  function isNativeDisableable(element: HTMLElement): element is NativeDisableable {
    return (
      element instanceof HTMLButtonElement ||
      element instanceof HTMLInputElement ||
      element instanceof HTMLSelectElement ||
      element instanceof HTMLTextAreaElement ||
      element instanceof HTMLFieldSetElement ||
      element instanceof HTMLOptGroupElement ||
      element instanceof HTMLOptionElement
    );
  }

  function appendId(value: string | null, id: string): string {
    const ids = (value ?? '').split(/\s+/).filter(Boolean);
    if (!ids.includes(id)) {
      ids.push(id);
    }
    return ids.join(' ');
  }

  function restoreAttribute(element: HTMLElement, name: string, value: string | null): void {
    if (value === null) {
      element.removeAttribute(name);
    } else {
      element.setAttribute(name, value);
    }
  }

  const disableDeniedControls: Attachment<HTMLElement> = (element) => {
    const restore = Array.from(element.querySelectorAll<HTMLElement>(INTERACTIVE_SELECTOR)).map(
      (control) => {
        const previousDisabled = isNativeDisableable(control) ? control.disabled : undefined;
        const previousAriaDisabled = control.getAttribute('aria-disabled');
        const previousTabindex = control.getAttribute('tabindex');
        const previousDescribedBy = control.getAttribute('aria-describedby');
        const previousHref =
          control instanceof HTMLAnchorElement ? control.getAttribute('href') : null;
        const previousDataControl = control.getAttribute('data-cinder-access-gate-control');

        control.setAttribute('data-cinder-access-gate-control', '');
        control.setAttribute('aria-describedby', appendId(previousDescribedBy, inlineReasonId));

        if (isNativeDisableable(control)) {
          control.disabled = true;
        } else {
          control.setAttribute('aria-disabled', 'true');
          control.setAttribute('tabindex', '-1');
          if (control instanceof HTMLAnchorElement) {
            control.removeAttribute('href');
          }
        }

        return () => {
          if (previousDisabled !== undefined && isNativeDisableable(control)) {
            control.disabled = previousDisabled;
          }
          restoreAttribute(control, 'aria-disabled', previousAriaDisabled);
          restoreAttribute(control, 'tabindex', previousTabindex);
          restoreAttribute(control, 'aria-describedby', previousDescribedBy);
          if (control instanceof HTMLAnchorElement) {
            restoreAttribute(control, 'href', previousHref);
          }
          restoreAttribute(control, 'data-cinder-access-gate-control', previousDataControl);
        };
      },
    );

    function preventActivation(event: Event): void {
      event.preventDefault();
      event.stopPropagation();
    }

    function preventKeyboardActivation(event: KeyboardEvent): void {
      if (event.key === 'Enter' || event.key === ' ') {
        preventActivation(event);
      }
    }

    element.addEventListener('click', preventActivation, true);
    element.addEventListener('keydown', preventKeyboardActivation, true);

    return () => {
      element.removeEventListener('click', preventActivation, true);
      element.removeEventListener('keydown', preventKeyboardActivation, true);
      for (const restoreControl of restore) {
        restoreControl();
      }
    };
  };
</script>

{#if granted}
  {@render children?.()}
{:else if variant === 'section'}
  <section
    {...rest}
    class={classNames('cinder-access-gate', customClassName)}
    data-cinder-variant="section"
    aria-labelledby={sectionTitleId}
    aria-describedby={sectionDescriptionIds}
  >
    <span class="cinder-access-gate__section-icon" aria-hidden="true">
      <Lock size={20} strokeWidth={2} />
    </span>
    <span class="cinder-access-gate__section-copy">
      <span id={sectionTitleId} class="cinder-access-gate__section-title">Section locked</span>
      <span id={sectionReasonId} class="cinder-access-gate__section-reason">{reason}</span>
      {#if requirement}
        <span id={sectionRequirementId} class="cinder-access-gate__requirement">
          <span class="cinder-access-gate__requirement-label">Required permission</span>
          <code class="cinder-access-gate__requirement-value">{requirement}</code>
        </span>
      {/if}
    </span>
  </section>
{:else}
  <span
    {...rest}
    class={classNames('cinder-access-gate', customClassName)}
    data-cinder-variant="inline"
    role="group"
    aria-disabled="true"
    aria-describedby={inlineReasonId}
  >
    <span class="cinder-access-gate__inline-content" {@attach disableDeniedControls}>
      {@render children?.()}
    </span>
    <span id={inlineReasonId} class="cinder-access-gate__inline-reason">
      <Lock size={14} strokeWidth={2} aria-hidden="true" />
      <span>{reason}</span>
    </span>
  </span>
{/if}
