import type { TableOfContentsItem } from './table-of-contents.types.ts';

export function flattenIds(source: TableOfContentsItem[]): string[] {
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

export function parseRootMarginToken(token: string, viewportHeight: number): number {
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

export function parseActivationOffset(rootMargin: string, viewportHeight: number): number {
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

export function pickActiveId(
  orderedElements: HTMLElement[],
  activationOffset: number,
): string | null {
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

/**
 * Tracks which heading id is "active" (i.e. currently in view per the
 * scroll-spy heuristic) via an IntersectionObserver plus a scroll/resize
 * fallback. `sync()` is called from a thin `$effect` in
 * table-of-contents.svelte — this class creates no `$effect` of its own.
 */
export class TableOfContentsActiveHeadingTracker {
  activeId = $state<string | null>(null);

  setActiveId(id: string): void {
    this.activeId = id;
  }

  sync(items: TableOfContentsItem[], rootMargin: string): () => void {
    if (typeof window === 'undefined') {
      return () => {};
    }

    const observedIds = flattenIds(items);

    if (observedIds.length === 0 || typeof IntersectionObserver === 'undefined') {
      this.activeId = null;
      return () => {};
    }

    const collectObservedElements = () =>
      observedIds
        .map((id) => document.getElementById(id))
        .filter((element): element is HTMLElement => element instanceof HTMLElement);

    let observedElements = collectObservedElements();

    let pendingAnimationFrame: number | null = null;

    const updateActiveId = () => {
      if (observedElements.length === 0) {
        this.activeId = null;
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

      this.activeId = pickActiveId(
        elementsInDocumentOrder,
        parseActivationOffset(rootMargin, window.innerHeight),
      );
    };

    const scheduleActiveIdUpdate = () => {
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
    };

    const observer = new IntersectionObserver(
      () => {
        scheduleActiveIdUpdate();
      },
      {
        root: null,
        rootMargin,
        threshold: [0, 1],
      },
    );

    for (const element of observedElements) {
      observer.observe(element);
    }

    const syncObservedElements = () => {
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
    };

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
  }
}
