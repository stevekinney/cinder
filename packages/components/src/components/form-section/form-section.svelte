<script lang="ts" module>
  /**
   * @cinder
   * @category form
   * @status stable
   * @purpose Sectioning wrapper that groups related form fields under a heading or legend and applies a responsive column layout.
   * @tag form
   * @tag layout
   * @useWhen Splitting a long form into labelled segments such as "Account" or "Billing".
   * @useWhen Rendering a fieldset with a legend for a set of tightly related inputs.
   * @avoidWhen Wrapping a single control with its label and error — use form-field instead.
   * @related form-field, section-heading
   */
  const headingTags: Record<FormSectionHeadingLevel, string> = {
    2: 'h2',
    3: 'h3',
    4: 'h4',
    5: 'h5',
    6: 'h6',
  };

  export type { FormSectionHeadingLevel, FormSectionProps } from './form-section.types.ts';
</script>

<script lang="ts">
  import type { FormSectionHeadingLevel, FormSectionProps } from './form-section.types.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import { devWarn } from '../../utilities/dev-warn.ts';

  let {
    as = 'section',
    heading,
    headingLevel = 2,
    description,
    columns = 2,
    class: className,
    children,
  }: FormSectionProps = $props();

  // Re-check reactively: `as` and `heading` are ordinary (non-bindable) props
  // that a parent can change on re-render, so the warning must fire whenever the
  // combination becomes invalid, not only at mount. devWarn self-gates on DEV.
  $effect(() => {
    if (as === 'fieldset' && !heading) {
      devWarn(
        '[cinder/FormSection] `as="fieldset"` requires a `heading` prop — a fieldset without a legend has no accessible group name.',
      );
    }
  });

  const headingTag = $derived(headingTags[headingLevel as FormSectionHeadingLevel] ?? 'h2');
</script>

{#if as === 'fieldset'}
  <fieldset class={classNames('cinder-form-section', className)} data-columns={columns}>
    {#if heading}
      <legend class="cinder-form-section__legend">{heading}</legend>
    {/if}
    {#if description}
      <p class="cinder-form-section__description">{description}</p>
    {/if}
    <div class="cinder-form-section__grid">
      {@render children()}
    </div>
  </fieldset>
{:else}
  <section class={classNames('cinder-form-section', className)} data-columns={columns}>
    {#if heading}
      <svelte:element this={headingTag} class="cinder-form-section__heading">
        {heading}
      </svelte:element>
    {/if}
    {#if description}
      <p class="cinder-form-section__description">{description}</p>
    {/if}
    <div class="cinder-form-section__grid">
      {@render children()}
    </div>
  </section>
{/if}
