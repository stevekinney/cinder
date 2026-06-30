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
  let derivedHeadingItems = $state<TableOfContentsItem[]>([]);
  const normalizedItems = $derived(
    items === undefined ? derivedHeadingItems : normalizeExplicitItems(items),
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
      return targetProp.isConnected ? targetProp : null;
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
      .filter(isNonNullable);

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

  $effect(() => {
    if (items !== undefined) {
      derivedHeadingItems = [];
      return;
    }

    if (typeof window === 'undefined' || typeof document === 'undefined') {
      derivedHeadingItems = [];
      return;
    }

    let targetObserver: MutationObserver | null = null;
    let targetParentObserver: MutationObserver | null = null;
    let documentObserver: MutationObserver | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let pendingDocumentRefresh: ReturnType<typeof setTimeout> | null = null;
    let observedTarget: HTMLElement | null = null;
    let observedTargetParent: HTMLElement | null = null;

    const clearRetryTimer = () => {
      if (retryTimer !== null) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
    };

    const clearPendingDocumentRefresh = () => {
      if (pendingDocumentRefresh !== null) {
        clearTimeout(pendingDocumentRefresh);
        pendingDocumentRefresh = null;
      }
    };

    const scheduleRetry = () => {
      if (retryTimer !== null) {
        return;
      }

      retryTimer = setTimeout(() => {
        retryTimer = null;
        refreshDerived();
      }, 50);
    };

    const syncTargetObserver = (nextTarget: HTMLElement | null) => {
      if (observedTarget !== nextTarget) {
        targetObserver?.disconnect();
        targetObserver = null;
        targetParentObserver?.disconnect();
        targetParentObserver = null;
        observedTarget = nextTarget;
        observedTargetParent = nextTarget?.parentElement ?? null;
      }

      if (
        nextTarget !== null &&
        targetObserver === null &&
        typeof MutationObserver !== 'undefined'
      ) {
        targetObserver = new MutationObserver(() => {
          refreshDerived();
        });
        targetObserver.observe(nextTarget, {
          childList: true,
          subtree: true,
          characterData: true,
          attributes: true,
        });
      }

      if (
        observedTargetParent !== null &&
        targetParentObserver === null &&
        typeof MutationObserver !== 'undefined'
      ) {
        targetParentObserver = new MutationObserver(() => {
          refreshDerived();
        });
        targetParentObserver.observe(observedTargetParent, {
          childList: true,
        });
      }
    };

    const shouldDeriveFromTarget =
      (typeof target === 'string' && target.trim() !== '') || target instanceof HTMLElement;
    const shouldWatchForTargetBySelector = typeof target === 'string' && target.trim() !== '';
    const shouldWatchTargetConnection = target instanceof HTMLElement;

    if (!shouldDeriveFromTarget) {
      derivedHeadingItems = [];
      return;
    }

    const refreshDerived = () => {
      const targetElement = resolveTargetElement(target);
      syncTargetObserver(targetElement);
      derivedHeadingItems = deriveItemsFromHeadings(targetElement, headingSelector);

      if (targetElement !== null) {
        clearRetryTimer();
      } else if (shouldWatchForTargetBySelector && typeof MutationObserver === 'undefined') {
        scheduleRetry();
      } else {
        clearRetryTimer();
      }
    };

    const scheduleDocumentRefreshCheck = () => {
      if (
        (!shouldWatchForTargetBySelector && !shouldWatchTargetConnection) ||
        pendingDocumentRefresh !== null
      ) {
        return;
      }
      if (observedTarget !== null && !document.contains(observedTarget)) {
        refreshDerived();
        return;
      }
      if (!shouldWatchForTargetBySelector) {
        return;
      }
      if (observedTarget !== null && document.contains(observedTarget)) {
        const latestTarget = resolveTargetElement(target);
        if (latestTarget === observedTarget) {
          return;
        }
      } else if (observedTarget !== null) {
        refreshDerived();
        return;
      }

      pendingDocumentRefresh = setTimeout(() => {
        pendingDocumentRefresh = null;
        const latestTarget = resolveTargetElement(target);
        if (latestTarget !== observedTarget) {
          refreshDerived();
        }
      }, 50);
    };

    if (
      (shouldWatchForTargetBySelector || shouldWatchTargetConnection) &&
      typeof MutationObserver !== 'undefined' &&
      document.body !== null
    ) {
      documentObserver = new MutationObserver(() => {
        scheduleDocumentRefreshCheck();
      });
      documentObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
      });
    }

    refreshDerived();

    return () => {
      clearRetryTimer();
      clearPendingDocumentRefresh();
      targetObserver?.disconnect();
      targetParentObserver?.disconnect();
      documentObserver?.disconnect();
    };
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

  function parseRootMarginToken(token: string, viewportHeight: number): number {
    if (token.endsWith('px')) {
      const value = Number.parseFloat(token);
      return Number.isFinite(value) ? value : 0;
    }
    if (token.endsWith('%')) {
      const percent = Number.parseFloat(token);
      return Number.isFinite(percent) ? (viewportHeight * percent) / 100 : 0;
    }
    return 0;
  }

  function parseActivationOffset(rootMargin: string, viewportHeight: number): number {
    const tokens = rootMargin
      .trim()
      .split(/\s+/)
      .filter((token) => token.length > 0);
    const [topToken, rightToken = topToken, bottomToken = topToken] = tokens;
    const resolvedTopToken = topToken ?? '0px';
    const resolvedBottomToken = bottomToken ?? rightToken ?? resolvedTopToken;
    const bottom = parseRootMarginToken(resolvedBottomToken, viewportHeight);
    return viewportHeight + bottom;
  }

  function pickActiveId(orderedElements: HTMLElement[], activationOffset: number): string | null {
    let lastPassed: { id: string; top: number } | null = null;
    let firstUpcoming: { id: string; top: number } | null = null;

    for (const element of orderedElements) {
      const top = element.getBoundingClientRect().top;
      if (top <= activationOffset) {
        lastPassed = { id: element.id, top };
        continue;
      }

      if (firstUpcoming === null || top < firstUpcoming.top) {
        firstUpcoming = { id: element.id, top };
      }
    }

    return lastPassed?.id ?? firstUpcoming?.id ?? null;
  }

  $effect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (observedIds.length === 0 || typeof IntersectionObserver === 'undefined') {
      activeId = null;
      return;
    }

    const collectObservedElements = () =>
      observedIds
        .map((id) => document.getElementById(id))
        .filter((element): element is HTMLElement => element instanceof HTMLElement);

    let observedElements = collectObservedElements();

    let pendingAnimationFrame: number | null = null;

    const updateActiveId = () => {
      if (observedElements.length === 0) {
        activeId = null;
        return;
      }

      const elementsInDocumentOrder = [...observedElements].sort((a, b) => {
        if (a === b) {
          return 0;
        }
        const relation = a.compareDocumentPosition(b);
        if ((relation & Node.DOCUMENT_POSITION_FOLLOWING) !== 0) {
          return -1;
        }
        if ((relation & Node.DOCUMENT_POSITION_PRECEDING) !== 0) {
          return 1;
        }
        return 0;
      });

      activeId = pickActiveId(
        elementsInDocumentOrder,
        parseActivationOffset(observeRootMargin, window.innerHeight),
      );
    };

    function scheduleActiveIdUpdate() {
      if (typeof window.requestAnimationFrame !== 'function') {
        updateActiveId();
        return;
      }
      if (pendingAnimationFrame !== null) {
        return;
      }
      pendingAnimationFrame = window.requestAnimationFrame(() => {
        pendingAnimationFrame = null;
        updateActiveId();
      });
    }

    const observer = new IntersectionObserver(
      () => {
        scheduleActiveIdUpdate();
      },
      {
        root: null,
        rootMargin: observeRootMargin,
        threshold: [0, 1],
      },
    );

    for (const element of observedElements) {
      observer.observe(element);
    }

    function syncObservedElements() {
      const nextObservedElements = collectObservedElements();
      const unchanged =
        observedElements.length === nextObservedElements.length &&
        observedElements.every((element, index) => element === nextObservedElements[index]);
      if (unchanged) {
        return;
      }

      observedElements = nextObservedElements;
      observer.disconnect();
      for (const element of observedElements) {
        observer.observe(element);
      }
      scheduleActiveIdUpdate();
    }

    window.addEventListener('scroll', scheduleActiveIdUpdate, { passive: true });
    window.addEventListener('resize', scheduleActiveIdUpdate);

    let domObserver: MutationObserver | null = null;
    if (typeof MutationObserver !== 'undefined' && document.body !== null) {
      domObserver = new MutationObserver(() => {
        syncObservedElements();
      });
      domObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['id'],
      });
    }

    updateActiveId();

    return () => {
      if (pendingAnimationFrame !== null && typeof window.cancelAnimationFrame === 'function') {
        window.cancelAnimationFrame(pendingAnimationFrame);
      }
      window.removeEventListener('scroll', scheduleActiveIdUpdate);
      window.removeEventListener('resize', scheduleActiveIdUpdate);
      domObserver?.disconnect();
      observer.disconnect();
    };
  });

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
  </nav>
{/if}
