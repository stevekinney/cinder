<script lang="ts" module>
  import type { HTMLAttributes } from 'svelte/elements';

  /** Available review document views. */
  export type ViewType = 'editor' | 'diff' | 'summary';

  export type ViewOption = {
    value: ViewType;
    label: string;
    description?: string;
  };

  export type ViewSwitcherProps = Omit<HTMLAttributes<HTMLDivElement>, 'class' | 'onchange'> & {
    /** Unique identifier for the tablist. */
    id: string;
    /** Active view. */
    value?: ViewType;
    /** Whether to include the diff tab. */
    showDiff?: boolean;
    /** Whether to include the summary tab. */
    showSummary?: boolean;
    /** Optional panel ID prefix for aria-controls. */
    panelIdPrefix?: string;
    /** Additional class names merged with `.cinder-view-switcher`. */
    class?: string;
    /** Called when the active view changes. */
    onchange?: (view: ViewType) => void;
  };
</script>

<script lang="ts">
  import { classNames } from '../utilities/class-names.ts';
  import { handleRovingKeydown } from '../utilities/roving-tabindex.ts';

  let {
    id,
    value = $bindable<ViewType>('editor'),
    showDiff = true,
    showSummary = true,
    panelIdPrefix,
    class: customClassName,
    onchange,
    ...rest
  }: ViewSwitcherProps = $props();

  const views: ViewOption[] = $derived.by(() => {
    const options: ViewOption[] = [
      { value: 'editor', label: 'Editor', description: 'Edit content' },
    ];
    if (showDiff) options.push({ value: 'diff', label: 'Diff', description: 'View changes' });
    if (showSummary) {
      options.push({ value: 'summary', label: 'Summary', description: 'Review summary' });
    }
    return options;
  });

  const selectedIndex = $derived(views.findIndex((view) => view.value === value));

  function selectView(view: ViewType): void {
    value = view;
    onchange?.(view);
  }

  function handleKeydown(event: KeyboardEvent): void {
    const currentIndex = selectedIndex >= 0 ? selectedIndex : 0;
    const nextIndex = handleRovingKeydown(event, currentIndex, views.length);

    if (nextIndex === null) return;

    event.preventDefault();
    if (nextIndex === currentIndex) return;

    const nextView = views[nextIndex];
    if (!nextView) return;

    selectView(nextView.value);
    document.getElementById(`${id}-tab-${nextView.value}`)?.focus();
  }
</script>

<div
  {id}
  class={classNames('cinder-view-switcher', customClassName)}
  role="tablist"
  aria-label="View options"
  onkeydown={handleKeydown}
  {...rest}
>
  {#each views as view (view.value)}
    {@const isSelected = value === view.value}
    <button
      type="button"
      id={`${id}-tab-${view.value}`}
      class="cinder-view-switcher__tab"
      role="tab"
      aria-selected={isSelected}
      aria-controls={panelIdPrefix ? `${panelIdPrefix}-${view.value}` : undefined}
      tabindex={isSelected ? 0 : -1}
      onclick={() => selectView(view.value)}
      title={view.description}
    >
      {#if view.value === 'editor'}
        <svg class="cinder-view-switcher__icon" aria-hidden="true" viewBox="0 0 24 24">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      {:else if view.value === 'diff'}
        <svg class="cinder-view-switcher__icon" aria-hidden="true" viewBox="0 0 24 24">
          <path d="M4 7h10" />
          <path d="M4 17h10" />
          <path d="M18 3v18" />
          <path d="m21 6-3-3-3 3" />
          <path d="m15 18 3 3 3-3" />
        </svg>
      {:else}
        <svg class="cinder-view-switcher__icon" aria-hidden="true" viewBox="0 0 24 24">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
          <path d="M14 2v6h6" />
          <path d="M16 13H8" />
          <path d="M16 17H8" />
          <path d="M10 9H8" />
        </svg>
      {/if}
      <span class="cinder-view-switcher__label">{view.label}</span>
    </button>
  {/each}
</div>
