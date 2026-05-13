<script lang="ts" module>
  import type { Snippet } from 'svelte';

  /** Heading level for the rendered section title. Sections nest, so this is
   *  the consumer's responsibility — there is no sensible global default beyond
   *  `2`, which suits a single-level section inside an `<h1>` page.
   *
   *  Deeper levels (`5`, `6`) are intentionally excluded: this primitive targets
   *  top-level section headers in page bodies, and very deep nesting usually
   *  signals a structural problem. Expand the union additively if needed later. */
  export type SectionHeadingLevel = 2 | 3 | 4;

  export type SectionHeadingProps = {
    /** Section title text. Rendered inside the dynamic heading element. */
    title: string;
    /** Optional supporting description. Supplementary body text, not a heading
     *  subtitle — rendered after the heading but outside `<hgroup>`. */
    description?: string;
    /** Heading level for the title element. Defaults to `2`. The correct level
     *  relative to the surrounding document outline is the consumer's responsibility. */
    level?: SectionHeadingLevel;
    /** Additional class names merged onto the root `<header>`. */
    class?: string;
    /** Optional small uppercase "eyebrow" label. When present, the label is
     *  rendered as a `<p>` inside an `<hgroup>` that also contains the heading.
     *
     *  The `<hgroup>` content model only permits `<p>` elements plus one
     *  heading element, so the snippet **must render phrasing content only** —
     *  plain text, `<span>`, `<strong>`, `<em>`, `<a>`, icons, etc. Do not
     *  render block elements (`<div>`, `<nav>`, `<button>` wrappers, additional
     *  headings) into this snippet; doing so produces invalid HTML inside
     *  `<hgroup>`. */
    label?: Snippet;
    /** Optional trailing actions (buttons, menus). Rendered on the same row
     *  as the title at wide viewports. */
    actions?: Snippet;
    /** Optional tablist. When both `actions` and `tabs` are present, `tabs`
     *  sits on a second row inside the shared `<header>`. */
    tabs?: Snippet;
  };
</script>

<script lang="ts">
  import { classNames } from '../utilities/class-names.ts';

  let {
    title,
    description,
    level = 2,
    class: className,
    label,
    actions,
    tabs,
  }: SectionHeadingProps = $props();

  const headingTag = $derived(`h${level}` satisfies `h${SectionHeadingLevel}`);
</script>

<header
  class={classNames('cinder-section-heading', className)}
  data-cinder-variant={actions && tabs ? 'actions-and-tabs' : undefined}
>
  <div class="cinder-section-heading__row">
    <div class="cinder-section-heading__primary">
      {#if label}
        <hgroup class="cinder-section-heading__hgroup">
          <p class="cinder-section-heading__label">{@render label()}</p>
          <svelte:element this={headingTag} class="cinder-section-heading__title"
            >{title}</svelte:element
          >
        </hgroup>
      {:else}
        <svelte:element this={headingTag} class="cinder-section-heading__title"
          >{title}</svelte:element
        >
      {/if}
      {#if description}
        <p class="cinder-section-heading__description">{description}</p>
      {/if}
    </div>
    {#if actions}
      <div class="cinder-section-heading__actions">{@render actions()}</div>
    {/if}
  </div>
  {#if tabs}
    <div class="cinder-section-heading__tabs">{@render tabs()}</div>
  {/if}
</header>
