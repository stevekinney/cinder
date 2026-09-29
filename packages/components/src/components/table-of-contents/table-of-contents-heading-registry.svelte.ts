import {
  deriveItemsFromHeadings,
  resolveTargetElement,
} from './table-of-contents-heading-derivation.ts';
import type { TableOfContentsItem, TableOfContentsProps } from './table-of-contents.types.ts';

const hasBrowserEnvironment = (): boolean =>
  typeof window !== 'undefined' && typeof document !== 'undefined';

const hasMutationObserver = (): boolean => typeof MutationObserver !== 'undefined';

const canCreateTargetObserver = (
  target: HTMLElement | null,
  observer: MutationObserver | null,
): target is HTMLElement => target !== null && observer === null && hasMutationObserver();

const canCreateParentObserver = (
  parent: HTMLElement | null,
  observer: MutationObserver | null,
): parent is HTMLElement => parent !== null && observer === null && hasMutationObserver();

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
    if (!hasBrowserEnvironment()) {
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

      if (canCreateTargetObserver(nextTarget, targetObserver)) {
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

      if (canCreateParentObserver(observedTargetParent, targetParentObserver)) {
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
      } else if (shouldWatchForTargetBySelector && !hasMutationObserver()) {
        scheduleRetry();
      } else {
        clearRetryTimer();
      }
    };

    const scheduleDocumentRefreshCheck = () => {
      const watchesTarget = shouldWatchForTargetBySelector || shouldWatchTargetConnection;
      if (!watchesTarget || pendingDocumentRefresh !== null) {
        return;
      }
      if (observedTarget !== null) {
        if (!document.contains(observedTarget)) {
          refreshDerived();
          return;
        }
        if (!shouldWatchForTargetBySelector) {
          return;
        }
        if (resolveTargetElement(target) === observedTarget) {
          return;
        }
      } else if (!shouldWatchForTargetBySelector) {
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

    const shouldObserveDocument =
      (shouldWatchForTargetBySelector || shouldWatchTargetConnection) &&
      hasMutationObserver() &&
      document.body !== null;
    if (shouldObserveDocument) {
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
