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
   * @a11yNote Denied inline gates render content inert before hydration, then disable controls, remove them from sequential focus, and wire the reason through aria-describedby.
   */
  export type { AccessGateProps, AccessGateVariant } from './access-gate.types.ts';
</script>

<script lang="ts">
  import { Lock } from 'lucide-svelte';

  import { classNames } from '../../utilities/class-names.ts';

  import AccessGateInline from './access-gate-inline.svelte';
  import type { AccessGateProps } from './access-gate.types.ts';

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
  const sectionTitleId = `${baseId}-title`;
  const sectionReasonId = `${baseId}-description`;
  const sectionRequirementId = `${baseId}-requirement`;
  const sectionDescriptionIds = $derived(
    requirement ? `${sectionReasonId} ${sectionRequirementId}` : sectionReasonId,
  );
  const passthroughAttributes = $derived(
    stripOwnedAccessibilityAttributes(rest as Record<string, unknown>),
  );

  function stripOwnedAccessibilityAttributes(
    attributes: Record<string, unknown>,
  ): Record<string, unknown> {
    const {
      role: _role,
      ['aria-describedby']: _ariaDescribedBy,
      ['aria-labelledby']: _ariaLabelledBy,
      ...passthrough
    } = attributes;
    return passthrough;
  }
</script>

{#if granted}
  <span class="cinder-access-gate__passthrough">
    {@render children?.()}
  </span>
{:else if variant === 'section'}
  <section
    {...passthroughAttributes}
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
  <AccessGateInline {...passthroughAttributes} class={customClassName} {reason}>
    {@render children?.()}
  </AccessGateInline>
{/if}
