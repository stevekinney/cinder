<script lang="ts" module>
  import type { Snippet } from 'svelte';
  import { DEV } from 'esm-env';

  export type FormSectionHeadingLevel = 2 | 3 | 4 | 5 | 6;

  type FormSectionSharedProps = {
    /** Optional descriptive paragraph rendered under the heading/legend. */
    description?: string;
    /** Column ceiling. Container queries pick the actual rendered count. Default 2. */
    columns?: 1 | 2 | 3 | 4;
    /** Additional class merged with `.cinder-form-section`. */
    class?: string;
    /** Children (FormField instances or arbitrary content). */
    children: Snippet;
  };

  /**
   * Discriminated union: `as="fieldset"` requires `heading` (a legend-less fieldset
   * has no accessible group name). `as="section"` (default) treats heading as optional.
   * This makes the inaccessible state unrepresentable in TypeScript.
   */
  export type FormSectionProps =
    | (FormSectionSharedProps & {
        /** Wrapper element. Default. */
        as?: 'section';
        /** Heading text rendered as `<h{level}>`. */
        heading?: string;
        /** Heading level. Default 2. */
        headingLevel?: FormSectionHeadingLevel;
      })
    | (FormSectionSharedProps & {
        /** Wrapper element. Use for grouped related inputs. */
        as: 'fieldset';
        /** Required heading — rendered as `<legend>`. */
        heading: string;
        /** Ignored for fieldset (legend is the only heading). */
        headingLevel?: never;
      });

  const headingTags: Record<FormSectionHeadingLevel, string> = {
    2: 'h2',
    3: 'h3',
    4: 'h4',
    5: 'h5',
    6: 'h6',
  };
</script>

<script lang="ts">
  import { classNames } from '../utilities/class-names.ts';

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
