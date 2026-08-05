<script lang="ts" module>
  /**
   * @cinder
   * @category navigation
   * @status beta
   * @purpose On-page heading outline that renders nested anchor links and highlights the active section while scrolling.
   * @tag navigation
   * @tag docs
   * @tag toc
   * @useWhen Adding an "On this page" rail for long-form docs or settings screens.
   * @useWhen Letting users jump between headings while keeping context via active-section highlighting.
   * @avoidWhen Navigating between routes or top-level app areas — use navigation-bar or side-navigation.
   * @avoidWhen The page has too few headings to justify a secondary navigation rail.
   * @avoidWhen Rendering expandable hierarchical data with selection state. | tree
   * @related side-navigation, tree, breadcrumbs, section-heading
   * @a11yPattern WAI-ARIA Navigation Landmark
   */
  export type { TableOfContentsItem, TableOfContentsProps } from './table-of-contents.types.ts';
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';
  import { useReducedMotion } from '../../utilities/use-reduced-motion.svelte.ts';
  import { TableOfContentsHeadingRegistry } from './table-of-contents-heading-registry.svelte.ts';
  import { TableOfContentsActiveHeadingTracker } from './table-of-contents-active-heading.svelte.ts';
  import type { TableOfContentsItem, TableOfContentsProps } from './table-of-contents.types.ts';

  type RuntimeProps = TableOfContentsProps & {
    'aria-label'?: unknown;
    'aria-labelledby'?: unknown;
  };

  let {
    ariaLabel = 'On this page',
    class: className,
    items,
    target,
    headingSelector = 'h2, h3, h4',
    observeRootMargin = '0% 0% -70% 0%',
    'aria-label': _ariaLabelAttribute,
    'aria-labelledby': _ariaLabelledbyAttribute,
    ...rest
  }: RuntimeProps = $props();

  const reducedMotion = useReducedMotion();
  const registry = new TableOfContentsHeadingRegistry();
  const tracker = new TableOfContentsActiveHeadingTracker();
  const normalizedItems = $derived(
    items === undefined ? registry.items : normalizeExplicitItems(items),
  );

  const validatedAriaLabel = $derived.by(() => {
    const trimmed = ariaLabel.trim();
    if (trimmed === '') {
      throw new Error('TableOfContents requires a non-empty ariaLabel.');
    }
    return trimmed;
  });

  function normalizeItem(raw: TableOfContentsItem): TableOfContentsItem | null {
    const id = raw.id.trim();
    const label = raw.label.trim();
    if (id === '' || label === '') {
      return null;
    }

    const normalizedChildren =
      raw.children?.map((child) => normalizeItem(child)).filter(isNonNullable) ?? [];

    const normalized: TableOfContentsItem = {
      id,
      label,
      children: normalizedChildren,
    };

    if (typeof raw.level === 'number' && Number.isFinite(raw.level)) {
      normalized.level = raw.level;
    }

    return normalized;
  }

  function normalizeExplicitItems(
    source: TableOfContentsItem[] | undefined,
  ): TableOfContentsItem[] {
    return source?.map((item) => normalizeItem(item)).filter(isNonNullable) ?? [];
  }

  function isNonNullable<TValue>(value: TValue | null | undefined): value is TValue {
    return value != null;
  }

  $effect(() => {
    if (items !== undefined) {
      registry.items = [];
      return;
    }
    return registry.sync(target, headingSelector);
  });

  $effect(() => tracker.sync(normalizedItems, observeRootMargin));

  function handleItemClick(event: MouseEvent, id: string) {
    const element = document.getElementById(id);
    if (element === null) {
      return;
    }

    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();
    tracker.setActiveId(id);
    element.scrollIntoView({
      behavior: reducedMotion.current ? 'auto' : 'smooth',
      block: 'start',
    });
    const hash = `#${id}`;
    if (window.location.hash !== hash) {
      history.replaceState(null, '', hash);
    }
  }
</script>

{#if normalizedItems.length > 0}
  <nav
    class={classNames('cinder-table-of-contents', className)}
    aria-label={validatedAriaLabel}
    {...rest}
  >
    {#snippet renderItems(entries: TableOfContentsItem[], nested = false)}
      <ul
        class={classNames(
          'cinder-table-of-contents__list',
          nested && 'cinder-table-of-contents__list--nested',
        )}
      >
        {#each entries as entry (entry.id)}
          <li class="cinder-table-of-contents__item" data-level={entry.level}>
            <a
              class={classNames(
                'cinder-table-of-contents__link',
                tracker.activeId === entry.id && 'cinder-table-of-contents__link--active',
              )}
              href={'#' + entry.id}
              aria-current={tracker.activeId === entry.id ? 'location' : undefined}
              onclick={(event) => handleItemClick(event, entry.id)}
            >
              {entry.label}
            </a>
            {#if (entry.children?.length ?? 0) > 0}
              {@render renderItems(entry.children ?? [], true)}
            {/if}
          </li>
        {/each}
      </ul>
    {/snippet}

    {@render renderItems(normalizedItems)}
  </nav>
{/if}
