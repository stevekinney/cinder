import type { TableOfContentsItem, TableOfContentsProps } from './table-of-contents.types.ts';

type ParsedHeading = {
  id: string;
  label: string;
  level: number;
};

function isNonNullable<TValue>(value: TValue | null | undefined): value is TValue {
  return value != null;
}

export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export function resolveTargetElement(
  targetProp: TableOfContentsProps['target'],
): HTMLElement | null {
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
    (document.getElementById(candidate) !== null && document.getElementById(candidate) !== heading)
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

export function deriveItemsFromHeadings(
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

/**
 * Derives `items` from live DOM headings under `target`, matching on
 * `headingSelector`. Owns the MutationObserver retry state machine that
 * re-derives when the target's heading content changes, when the target
 * itself appears/disappears (selector-based targets), or when a watched
 * `HTMLElement` target is disconnected/reconnected.
 *
 * `sync()` is called from a thin `$effect` in table-of-contents.svelte —
 * this class itself creates no `$effect`; it only owns `$state` and
 * imperative DOM observer bookkeeping.
 */
export class TableOfContentsHeadingRegistry {
  items = $state<TableOfContentsItem[]>([]);

  sync(target: TableOfContentsProps['target'], headingSelector: string): () => void {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      this.items = [];
      return () => {};
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
          // ensureHeadingId is the only attribute-driven reason to
          // recompute — an author's own attribute churn elsewhere inside
          // the target (class/style/data-*) must not re-trigger derivation.
          attributeFilter: ['id'],
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
      this.items = [];
      return () => {};
    }

    const refreshDerived = () => {
      const targetElement = resolveTargetElement(target);
      syncTargetObserver(targetElement);
      this.items = deriveItemsFromHeadings(targetElement, headingSelector);

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
        // scheduleDocumentRefreshCheck only cares about the watched target
        // appearing, disappearing, or a selector re-matching — which
        // depends only on id/class attribute changes plus childList.
        attributeFilter: ['id', 'class'],
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
  }
}
