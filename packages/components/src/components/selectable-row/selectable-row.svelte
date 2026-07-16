<script lang="ts" module>
  /**
   * @cinder
   * @category action
   * @status beta
   * @purpose Full-width row with a native button or link primary action and independent sibling trailing actions.
   * @tag row
   * @tag list
   * @tag selection
   * @tag navigation
   * @useWhen The main row body must activate as one native action while rename, menu, or external-link controls remain independently focusable.
   * @useWhen A rich row needs leading, title, description, and metadata regions plus multiple trailing controls.
   * @avoidWhen The entire row is one button with no interactive trailing content. | action-row
   * @avoidWhen Only the title links and the rest of the row is static record content. | stacked-list-item
   * @related action-row, stacked-list-item, button
   * @a11yPattern Native button or link
   * @keyboardShortcut Enter | Activates the primary button or link.
   * @keyboardShortcut Space | Activates the primary action when it is a button.
   * @a11yNote The primary action and trailing controls are siblings, so trailing activation never bubbles through the primary action.
   */
  export type {
    SelectableRowCurrentValue,
    SelectableRowDensity,
    SelectableRowProps,
    SelectableRowSchemaProps,
    SelectableRowSelectedState,
  } from './selectable-row.types.ts';
</script>

<script lang="ts">
  import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';

  import { classNames } from '../../utilities/class-names.ts';
  import type { SelectableRowProps } from './selectable-row.types.ts';

  let {
    density = 'comfortable',
    selected = false,
    selectedState = 'pressed',
    href,
    currentValue = 'true',
    type = 'button',
    leading,
    title,
    description,
    meta,
    trailingActions,
    class: className,
    style,
    ...rest
  }: SelectableRowProps = $props();

  const isLink = $derived(href !== undefined);
  const selectedDataAttribute = $derived(selected ? '' : undefined);
  const ariaPressed = $derived(!isLink && selectedState === 'pressed' ? selected : undefined);
  const ariaCurrent = $derived(
    selected && (isLink || selectedState === 'current') ? currentValue : undefined,
  );
  const anchorAttributes = $derived(rest as Omit<HTMLAnchorAttributes, 'class' | 'href' | 'style'>);
  const buttonAttributes = $derived(rest as Omit<HTMLButtonAttributes, 'class' | 'style' | 'type'>);
  const resolvedRel = $derived.by(() => {
    if (!isLink) return undefined;

    const consumerTokens = (anchorAttributes.rel ?? '').split(/\s+/).filter(Boolean);
    const seen = new Set<string>();
    const merged: string[] = [];

    for (const token of consumerTokens) {
      const normalizedToken = token.toLowerCase();
      if (!seen.has(normalizedToken)) {
        seen.add(normalizedToken);
        merged.push(token);
      }
    }

    if (anchorAttributes.target?.toLowerCase() === '_blank') {
      for (const token of ['noopener', 'noreferrer']) {
        if (!seen.has(token)) {
          seen.add(token);
          merged.push(token);
        }
      }
    }

    return merged.length > 0 ? merged.join(' ') : undefined;
  });
</script>

<div
  class={classNames(
    'cinder-selectable-row',
    leading && 'cinder-selectable-row--has-leading',
    trailingActions && 'cinder-selectable-row--has-trailing-actions',
    className,
  )}
  {style}
  data-cinder-density={density}
  data-cinder-selected={selectedDataAttribute}
>
  {#if isLink}
    <a
      {...anchorAttributes}
      class="cinder-selectable-row__primary"
      {href}
      rel={resolvedRel}
      aria-current={ariaCurrent}
    >
      {#if leading}
        <span class="cinder-selectable-row__leading">{@render leading()}</span>
      {/if}
      <span class="cinder-selectable-row__body">
        <span class="cinder-selectable-row__title">{@render title()}</span>
        {#if description}
          <span class="cinder-selectable-row__description">{@render description()}</span>
        {/if}
        {#if meta}<span class="cinder-selectable-row__meta">{@render meta()}</span>{/if}
      </span>
    </a>
  {:else}
    <button
      {...buttonAttributes}
      class="cinder-selectable-row__primary"
      {type}
      aria-pressed={ariaPressed}
      aria-current={ariaCurrent}
    >
      {#if leading}
        <span class="cinder-selectable-row__leading">{@render leading()}</span>
      {/if}
      <span class="cinder-selectable-row__body">
        <span class="cinder-selectable-row__title">{@render title()}</span>
        {#if description}
          <span class="cinder-selectable-row__description">{@render description()}</span>
        {/if}
        {#if meta}<span class="cinder-selectable-row__meta">{@render meta()}</span>{/if}
      </span>
    </button>
  {/if}

  {#if trailingActions}
    <div class="cinder-selectable-row__trailing-actions">
      {@render trailingActions()}
    </div>
  {/if}
</div>
