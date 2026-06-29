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
   * @related side-navigation, breadcrumbs, section-heading
   * @a11yPattern WAI-ARIA Navigation Landmark
   */
  export type { TableOfContentsItem, TableOfContentsProps } from './table-of-contents.types.ts';
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';
  import { useReducedMotion } from '../../utilities/use-reduced-motion.svelte.ts';
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
  let activeId = $state<string | null>(null);

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
      raw.children?.map((child) => normalizeItem(child)).filter((child) => child !== null) ?? [];

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
    return source?.map((item) => normalizeItem(item)).filter((item) => item !== null) ?? [];
  }

  function slugifyHeading(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }

  function resolveTargetElement(targetProp: TableOfContentsProps['target']): HTMLElement | null {
    if (typeof document === 'undefined') {
      return null;
    }

    if (typeof targetProp === 'string') {
      const selector = targetProp.trim();
      if (selector === '') {
        return null;
      }
      return document.querySelector<HTMLElement>(selector);
    }

    if (targetProp instanceof HTMLElement) {
      return targetProp;
    }

    return null;
  }

  type ParsedHeading = {
    id: string;
    label: string;
    level: number;
  };

  function parseHeadingLevel(heading: HTMLElement): number | null {
    const match = /^H([1-6])$/.exec(heading.tagName);
    if (!match) {
      return null;
    }

    return Number(match[1]);
  }

  function ensureHeadingId(
    heading: HTMLElement,
    fallbackLabel: string,
    index: number,
    seenIds: Set<string>,
  ): string {
    const rawId = heading.id.trim();
    const baseId =
      rawId !== '' ? rawId : slugifyHeading(fallbackLabel) || `section-${Math.max(index + 1, 1)}`;

    let candidate = baseId;
    let suffix = 2;

    while (
      seenIds.has(candidate) ||
      (document.getElementById(candidate) !== null &&
        document.getElementById(candidate) !== heading)
    ) {
      candidate = `${baseId}-${suffix}`;
      suffix += 1;
    }

    if (heading.id !== candidate) {
      heading.id = candidate;
    }

    seenIds.add(candidate);
    return candidate;
  }

  function deriveItemsFromHeadings(
    targetElement: HTMLElement | null,
    selector: string,
  ): TableOfContentsItem[] {
    if (targetElement === null) {
      return [];
    }

    const selectorToUse = selector.trim() === '' ? 'h2, h3, h4' : selector;
    const headings = [...targetElement.querySelectorAll<HTMLElement>(selectorToUse)];
    const seenIds = new Set<string>();

    const parsed: ParsedHeading[] = headings
      .map((heading, index) => {
        const label = heading.textContent?.trim() ?? '';
        if (label === '') {
          return null;
        }

        const level = parseHeadingLevel(heading);
        if (level === null) {
          return null;
        }

        const id = ensureHeadingId(heading, label, index, seenIds);
        return { id, label, level };
      })
      .filter((heading) => heading !== null);

    const nested: TableOfContentsItem[] = [];
    const stack: Array<{ level: number; item: TableOfContentsItem }> = [];

    for (const heading of parsed) {
      const item: TableOfContentsItem = {
        id: heading.id,
        label: heading.label,
        level: heading.level,
        children: [],
      };

      while (stack.length > 0 && heading.level <= stack[stack.length - 1]!.level) {
        stack.pop();
      }

      if (stack.length === 0) {
        nested.push(item);
      } else {
        stack[stack.length - 1]!.item.children?.push(item);
      }

      stack.push({ level: heading.level, item });
    }

    return nested;
  }

  const normalizedItems = $derived.by(() => {
    const explicit = normalizeExplicitItems(items);
    if (explicit.length > 0) {
      return explicit;
    }

    const targetElement = resolveTargetElement(target);
    return deriveItemsFromHeadings(targetElement, headingSelector);
  });

  function flattenIds(source: TableOfContentsItem[]): string[] {
    const ids: string[] = [];

    const visit = (entries: TableOfContentsItem[]) => {
      for (const entry of entries) {
        ids.push(entry.id);
        if ((entry.children?.length ?? 0) > 0) {
          visit(entry.children ?? []);
        }
      }
    };

    visit(source);
    return ids;
  }

  const observedIds = $derived.by(() => flattenIds(normalizedItems));

  function pickActiveId(topById: Map<string, number>): string | null {
    let bestAbove: { id: string; top: number } | null = null;
    let bestBelow: { id: string; top: number } | null = null;

    for (const [id, top] of topById) {
      if (top <= 96) {
        if (bestAbove === null || top > bestAbove.top) {
          bestAbove = { id, top };
        }
      } else if (bestBelow === null || top < bestBelow.top) {
        bestBelow = { id, top };
      }
    }

    return bestAbove?.id ?? bestBelow?.id ?? null;
  }

  $effect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (observedIds.length === 0 || typeof IntersectionObserver === 'undefined') {
      activeId = null;
      return;
    }

    const topById = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const target = entry.target;
          if (!(target instanceof HTMLElement)) {
            continue;
          }

          if (entry.isIntersecting) {
            topById.set(target.id, entry.boundingClientRect.top);
          } else {
            topById.delete(target.id);
          }
        }

        activeId = pickActiveId(topById);
      },
      {
        root: null,
        rootMargin: observeRootMargin,
        threshold: [0, 1],
      },
    );

    for (const id of observedIds) {
      const element = document.getElementById(id);
      if (element !== null) {
        observer.observe(element);
      }
    }

    return () => {
      observer.disconnect();
    };
  });

  function handleItemClick(event: MouseEvent, id: string) {
    const element = document.getElementById(id);
    if (element === null) {
      return;
    }

    event.preventDefault();
    activeId = id;
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

<nav
  class={classNames('cinder-table-of-contents', className)}
  aria-label={validatedAriaLabel}
  {...rest}
>
  {#if normalizedItems.length > 0}
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
                activeId === entry.id && 'cinder-table-of-contents__link--active',
              )}
              href={'#' + entry.id}
              aria-current={activeId === entry.id ? 'location' : undefined}
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
  {/if}
</nav>
