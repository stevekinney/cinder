<script lang="ts" module>
  /**
   * @cinder
   * @category layout
   * @status stable
   * @purpose Surface container that groups related content with optional header, title, description, and footer regions.
   * @tag layout
   * @tag container
   * @useWhen Grouping a self-contained unit of content such as a summary, preview, or settings panel.
   * @useWhen Composing a list of comparable items where each needs its own framed region.
   * @avoidWhen Rendering a bare visual surface without slotted regions — use surface instead.
   * @avoidWhen Presenting a single key metric — use stat or stat-group instead.
   * @related surface, stat, stacked-list-item, section-heading
   */
  export type {
    CardHeadingLevel,
    CardPadding,
    CardProps,
    CardSurfaceTone,
    CardTone,
    CardVariant,
  } from './card.types.ts';
</script>

<script lang="ts">
  import CircleAlert from 'lucide-svelte/icons/circle-alert';

  import type { CardProps } from './card.types.ts';
  import { composeDescribedBy } from '../../_internal/field-control.ts';
  import { classNames } from '../../utilities/class-names.ts';

  const generatedId = $props.id();

  let {
    class: className,
    children,
    header,
    title,
    headingLevel = 3,
    description,
    footer,
    variant = 'card',
    tone = 'default',
    bodyTone = 'default',
    footerTone = 'default',
    edgeToEdgeOnMobile = false,
    padding = 'default',
    ...rest
  }: CardProps = $props();

  // Coerce + clamp at runtime: a consumer can pass 0, 7, NaN, or a non-numeric
  // value (JS callers, schema-driven usage). Building `h${headingLevel}` directly
  // would emit invalid markup like <h0>/<hNaN>. Matches EmptyState's heading clamp.
  const resolvedHeadingLevel = $derived(
    Number.isFinite(Math.trunc(Number(headingLevel)))
      ? Math.min(6, Math.max(1, Math.trunc(Number(headingLevel))))
      : 3,
  );
  const titleTag = $derived(`h${resolvedHeadingLevel}` as const);
  const hasGeneratedHeader = $derived(Boolean(title && !header));
  const titleId = $derived(hasGeneratedHeader ? `${generatedId}-title` : undefined);
  const descriptionId = $derived(
    hasGeneratedHeader && description ? `${generatedId}-description` : undefined,
  );
  const hasExternalRole = $derived(typeof rest.role === 'string' && rest.role.trim().length > 0);
  const hasExternalLabel = $derived(
    (typeof rest['aria-labelledby'] === 'string' && rest['aria-labelledby'].trim().length > 0) ||
      (typeof rest['aria-label'] === 'string' && rest['aria-label'].trim().length > 0),
  );
  const describedBy = $derived(composeDescribedBy(descriptionId, rest['aria-describedby']));
  const labelAttributes = $derived(
    hasGeneratedHeader
      ? {
          ...(!hasExternalRole ? { role: 'group' } : {}),
          ...(!hasExternalLabel ? { 'aria-labelledby': titleId } : {}),
          ...(describedBy ? { 'aria-describedby': describedBy } : {}),
        }
      : {},
  );
</script>

<div
  {...rest}
  class={classNames('cinder-card', className)}
  data-cinder-variant={variant}
  data-cinder-tone={tone}
  data-cinder-edge-to-edge-mobile={edgeToEdgeOnMobile ? '' : undefined}
  {...labelAttributes}
>
  {#if header}
    <div class="cinder-card__header">
      {@render header()}
    </div>
  {:else if title}
    <div class="cinder-card__header">
      <div class="cinder-card__title-row">
        {#if tone === 'danger'}
          <span class="cinder-card__risk-icon" aria-hidden="true">
            <CircleAlert size={18} strokeWidth={2.25} />
          </span>
        {/if}
        <svelte:element this={titleTag} id={titleId} class="cinder-card__title"
          >{title}</svelte:element
        >
      </div>
      {#if description}
        <p id={descriptionId} class="cinder-card__description">{description}</p>
      {/if}
    </div>
  {/if}

  <div class="cinder-card__body" data-cinder-tone={bodyTone} data-cinder-padding={padding}>
    {@render children()}
  </div>

  {#if footer}
    <div class="cinder-card__footer" data-cinder-tone={footerTone}>
      {@render footer()}
    </div>
  {/if}
</div>
