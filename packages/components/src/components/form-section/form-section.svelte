<script lang="ts" module>
  import { DEV } from 'esm-env';

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

  let {
    as = 'section',
    heading,
    headingLevel = 2,
    description,
    columns = 2,
    class: className,
    children,
  }: FormSectionProps = $props();

  const headingTag = $derived(headingTags[headingLevel as FormSectionHeadingLevel] ?? 'h2');

  $effect(() => {
    if (!DEV) return;
    if (as === 'fieldset' && !heading) {
      console.warn(
        '[cinder/FormSection] `as="fieldset"` requires a `heading` prop — a fieldset without a legend has no accessible group name.',
      );
    }
  });
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
