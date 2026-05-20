<script lang="ts" module>
  /**
   * @cinder
   * @category typography
   * @status stable
   * @purpose Section header that renders a leveled heading with optional eyebrow label, description, actions, and tabs row.
   * @tag typography
   * @tag heading
   * @useWhen Introducing a top-level section of a page with a title and supporting metadata.
   * @useWhen Pairing a section title with inline actions or a tab row beneath the heading.
   * @avoidWhen Labelling a single form control or field — use label instead.
   * @avoidWhen Rendering a page-wide header with primary navigation — use page-layout primitives instead.
   * @related page-layout, card, tab-list
   */
  export type { SectionHeadingLevel, SectionHeadingProps } from './section-heading.types.ts';
</script>

<script lang="ts">
  import type { SectionHeadingLevel, SectionHeadingProps } from './section-heading.types.ts';
  import { classNames } from '../../utilities/class-names.ts';

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
