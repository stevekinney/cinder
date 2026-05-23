<script lang="ts" module>
  /**
   * @cinder
   * @category action
   * @status stable
   * @purpose Named grouping of related controls that implements the WAI-ARIA toolbar pattern with DOM-driven roving tabindex.
   * @tag action
   * @tag grouping
   * @useWhen Rendering a row or column of related controls where the whole set should be one Tab stop and arrow keys should move between items.
   * @useWhen Wrapping existing cinder controls such as Button, SegmentedControl, and NumberInput without adding toolbar-specific child APIs.
   * @avoidWhen Building a static flex row of controls that should remain in ordinary Tab order — use inline, cluster, or button-group instead.
   * @related button-group, segmented-control, number-input
   */
  export type { ToolbarOrientation, ToolbarProps } from './toolbar.types.ts';
</script>

<script lang="ts">
  import { DEV } from 'esm-env';
  import { untrack } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';
  import { on } from 'svelte/events';

  import { classNames } from '../../utilities/class-names.ts';
  import { getFocusableIndex, handleRovingKeydown } from '../../utilities/roving-tabindex.ts';
  import type { ToolbarProps } from './toolbar.types.ts';

  type EditableElement = HTMLInputElement | HTMLTextAreaElement | HTMLElement;
  type ToolbarRuntimeProps = ToolbarProps & {
    role?: unknown;
    'aria-orientation'?: unknown;
    onkeydown?: HTMLAttributes<HTMLDivElement>['onkeydown'];
    onfocusin?: HTMLAttributes<HTMLDivElement>['onfocusin'];
  };

  const focusableSelector = [
    'button',
    'a[href]',
    'input',
    'select',
    'textarea',
    '[tabindex]',
    '[data-cinder-toolbar-item]',
  ].join(',');

  let {
    class: className,
    orientation = 'horizontal',
    children,
    onkeydown: consumerOnKeyDown,
    onfocusin: consumerOnFocusIn,
    role: _role,
    'aria-orientation': _ariaOrientation,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    ...rest
  }: ToolbarRuntimeProps = $props();

  let rootElement = $state<HTMLDivElement | null>(null);
  let toolbarItems = $state<HTMLElement[]>([]);
  let activeItem = $state<HTMLElement | null>(null);

  const originalTabIndexes = new WeakMap<HTMLElement, string | null>();
  let previousManagedItems = new Set<HTMLElement>();
  let cleanupKeyboardListener: (() => void) | null = null;
  let cleanupFocusInListener: (() => void) | null = null;
  let mutationObserver: MutationObserver | null = null;
  let lastWarnedNameSource = '';

  function isHTMLElement(value: Element | EventTarget | null): value is HTMLElement {
    return value instanceof HTMLElement;
  }

  function isHiddenInput(element: HTMLElement): boolean {
    return element instanceof HTMLInputElement && element.type === 'hidden';
  }

  function isEditableTarget(element: HTMLElement): element is EditableElement {
    if (element instanceof HTMLTextAreaElement) return true;
    if (element instanceof HTMLInputElement) {
      return ![
        'button',
        'checkbox',
        'file',
        'hidden',
        'image',
        'radio',
        'range',
        'reset',
        'submit',
      ].includes(element.type);
    }
    return element.isContentEditable;
  }

  function isSpinButtonLike(element: HTMLElement): boolean {
    if (element.getAttribute('role') === 'spinbutton') return true;
    if (!(element instanceof HTMLInputElement)) return false;
    return element.closest('.cinder-number-input') !== null;
  }

  function hasCollapsedSelectionAtBoundary(
    element: HTMLElement,
    direction: -1 | 1,
  ): element is HTMLInputElement | HTMLTextAreaElement {
    if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement))
      return false;
    if (typeof element.selectionStart !== 'number' || typeof element.selectionEnd !== 'number')
      return false;
    if (element.selectionStart !== element.selectionEnd) return false;
    const valueLength = element.value.length;
    return direction === -1 ? element.selectionStart === 0 : element.selectionEnd === valueLength;
  }

  function placeCaretForDirection(element: HTMLElement, direction: -1 | 1): void {
    if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) return;
    if (typeof element.setSelectionRange !== 'function') return;
    const position = direction === -1 ? element.value.length : 0;
    element.setSelectionRange(position, position);
  }

  function isCssHidden(element: HTMLElement): boolean {
    const elementStyle = getComputedStyle(element);
    if (elementStyle.display === 'none' || elementStyle.visibility === 'hidden') return true;

    let current = element.parentElement;
    while (current) {
      if (getComputedStyle(current).display === 'none') return true;
      current = current.parentElement;
    }
    return false;
  }

  function isDisabledByFieldset(element: HTMLElement): boolean {
    const disabledFieldset = element.closest('fieldset[disabled]');
    if (!disabledFieldset) return false;
    const firstLegend = disabledFieldset.querySelector('legend');
    return firstLegend ? !firstLegend.contains(element) : true;
  }

  function isEligibleToolbarItem(element: HTMLElement): boolean {
    if (!rootElement || element === rootElement) return false;
    if (!rootElement.contains(element)) return false;
    if (isHiddenInput(element)) return false;
    if (element.hasAttribute('hidden')) return false;
    if (element.getAttribute('aria-hidden') === 'true') return false;
    if (element.getAttribute('aria-disabled') === 'true') return false;
    if ('disabled' in element && typeof (element as HTMLButtonElement).disabled === 'boolean') {
      if ((element as HTMLButtonElement).disabled) return false;
    }
    if (element.closest('[hidden],[aria-hidden=\"true\"],[data-cinder-toolbar-exclude]'))
      return false;
    if (element.closest('[inert]')) return false;
    if (isDisabledByFieldset(element)) return false;
    if (isCssHidden(element)) return false;
    const authoredTabIndex = element.getAttribute('tabindex');
    if (
      authoredTabIndex === '-1' &&
      !previousManagedItems.has(element) &&
      !element.hasAttribute('data-cinder-toolbar-item')
    ) {
      return false;
    }
    return true;
  }

  function getToolbarItems(): HTMLElement[] {
    if (!rootElement) return [];
    return Array.from(rootElement.querySelectorAll<HTMLElement>(focusableSelector)).filter(
      (element) => isEligibleToolbarItem(element),
    );
  }

  function getActiveIndex(items: HTMLElement[], preferredItem: HTMLElement | null): number {
    if (preferredItem) {
      const preferredIndex = items.indexOf(preferredItem);
      if (preferredIndex >= 0) return preferredIndex;
    }
    return getFocusableIndex(-1, items.length);
  }

  function restoreDepartedItems(nextItems: HTMLElement[]): void {
    const nextItemSet = new Set(nextItems);
    for (const item of previousManagedItems) {
      if (nextItemSet.has(item)) continue;
      const original = originalTabIndexes.get(item);
      if (original === null) item.removeAttribute('tabindex');
      else if (original !== undefined) item.setAttribute('tabindex', original);
      originalTabIndexes.delete(item);
    }
    previousManagedItems = nextItemSet;
  }

  function syncToolbarItems(preferredItem: HTMLElement | null = activeItem): void {
    const items = getToolbarItems();
    restoreDepartedItems(items);

    if (items.length === 0) {
      toolbarItems = [];
      activeItem = null;
      return;
    }

    for (const item of items) {
      if (!originalTabIndexes.has(item)) {
        originalTabIndexes.set(item, item.getAttribute('tabindex'));
      }
    }

    const activeIndex = getActiveIndex(items, preferredItem);
    const resolvedActiveItem = activeIndex >= 0 ? (items[activeIndex] ?? null) : null;

    for (const [index, item] of items.entries()) {
      const nextTabIndex = index === activeIndex ? 0 : -1;
      if (item.tabIndex !== nextTabIndex) {
        item.tabIndex = nextTabIndex;
      }
    }

    toolbarItems = items;
    activeItem = resolvedActiveItem;
  }

  function moveFocus(nextIndex: number, direction: -1 | 1): void {
    const nextItem = toolbarItems[nextIndex];
    if (!nextItem) return;
    activeItem = nextItem;
    syncToolbarItems(nextItem);
    nextItem.focus();
    placeCaretForDirection(nextItem, direction);
  }

  function getCurrentToolbarIndex(target: HTMLElement): number {
    return toolbarItems.indexOf(target);
  }

  function handleEditableEscape(target: HTMLElement): boolean {
    if (!isEditableTarget(target)) return false;
    const currentIndex = getCurrentToolbarIndex(target);
    if (currentIndex < 0) return false;
    const nextIndex =
      currentIndex < toolbarItems.length - 1
        ? currentIndex + 1
        : currentIndex > 0
          ? currentIndex - 1
          : -1;
    if (nextIndex < 0) return false;
    moveFocus(nextIndex, 1);
    return true;
  }

  function handleToolbarKeyDown(event: KeyboardEvent): void {
    consumerOnKeyDown?.(event as KeyboardEvent & { currentTarget: EventTarget & HTMLDivElement });
    if (event.defaultPrevented) return;
    if (!isHTMLElement(event.target)) return;

    const target = event.target.closest<HTMLElement>(focusableSelector);
    if (!target || !toolbarItems.includes(target)) return;

    const currentIndex = getCurrentToolbarIndex(target);
    if (currentIndex < 0) return;

    const horizontal = orientation !== 'vertical';
    const targetIsEditable = isEditableTarget(target);

    if (event.key === 'Escape' && targetIsEditable) {
      if (!handleEditableEscape(target)) return;
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if ((event.key === 'Home' || event.key === 'End') && targetIsEditable) {
      return;
    }

    if (horizontal && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
      if (
        targetIsEditable &&
        !hasCollapsedSelectionAtBoundary(target, event.key === 'ArrowLeft' ? -1 : 1)
      ) {
        return;
      }
    }

    if (!horizontal && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      if (targetIsEditable || isSpinButtonLike(target)) return;
    }

    if (horizontal && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      return;
    }

    if (!horizontal && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
      return;
    }

    const nextIndex = handleRovingKeydown(event, currentIndex, toolbarItems.length, {
      horizontal,
      vertical: !horizontal,
    });
    if (nextIndex === null || nextIndex === currentIndex) return;

    event.preventDefault();
    event.stopPropagation();
    moveFocus(
      nextIndex,
      event.key === 'ArrowLeft' || event.key === 'ArrowUp' || event.key === 'Home' ? -1 : 1,
    );
  }

  function handleToolbarFocusIn(event: FocusEvent): void {
    consumerOnFocusIn?.(event as FocusEvent & { currentTarget: EventTarget & HTMLDivElement });
    if (!isHTMLElement(event.target)) return;
    const target = event.target.closest<HTMLElement>(focusableSelector);
    if (!target || !isEligibleToolbarItem(target)) return;
    syncToolbarItems(target);
  }

  function resolveAccessibleNameSource(): string {
    const inlineLabel = ariaLabel?.trim() ?? '';
    const labelledBy = ariaLabelledBy?.trim() ?? '';
    return inlineLabel || labelledBy;
  }

  function hasResolvedLabelledByText(): boolean {
    if (!rootElement || !ariaLabelledBy) return false;
    const identifiers = ariaLabelledBy
      .split(/\s+/)
      .map((value) => value.trim())
      .filter(Boolean);
    if (identifiers.length === 0) return false;
    return identifiers.every((identifier) => {
      const element = document.getElementById(identifier);
      return element !== null && (element.textContent?.trim().length ?? 0) > 0;
    });
  }

  function warnAboutAccessibleName(): void {
    if (!DEV || !rootElement) return;
    const warningKey = `${ariaLabel ?? ''}|${ariaLabelledBy ?? ''}`;
    if (warningKey === lastWarnedNameSource) return;

    const inlineLabel = ariaLabel?.trim() ?? '';
    if (inlineLabel.length > 0) return;
    if (ariaLabelledBy?.trim() && hasResolvedLabelledByText()) return;

    lastWarnedNameSource = warningKey;
    console.warn(
      '[cinder/Toolbar] rendered without a resolvable accessible name. Pass a non-empty `aria-label` or `aria-labelledby` that points to non-empty text.',
    );
  }

  $effect(() => {
    if (!rootElement) return;

    syncToolbarItems(untrack(() => activeItem));
    cleanupKeyboardListener?.();
    cleanupFocusInListener?.();
    cleanupKeyboardListener = on(rootElement, 'keydown', handleToolbarKeyDown, { capture: true });
    cleanupFocusInListener = on(rootElement, 'focusin', handleToolbarFocusIn);

    mutationObserver?.disconnect();
    mutationObserver = new MutationObserver(() => {
      syncToolbarItems(activeItem);
      warnAboutAccessibleName();
    });
    mutationObserver.observe(rootElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: [
        'aria-disabled',
        'aria-hidden',
        'aria-label',
        'aria-labelledby',
        'class',
        'data-cinder-toolbar-exclude',
        'data-cinder-toolbar-item',
        'disabled',
        'hidden',
        'inert',
        'style',
        'type',
      ],
    });

    warnAboutAccessibleName();

    return () => {
      cleanupKeyboardListener?.();
      cleanupFocusInListener?.();
      cleanupKeyboardListener = null;
      cleanupFocusInListener = null;
      mutationObserver?.disconnect();
      mutationObserver = null;
      restoreDepartedItems([]);
    };
  });
</script>

<div
  bind:this={rootElement}
  {...rest}
  role="toolbar"
  aria-label={ariaLabel}
  aria-labelledby={ariaLabelledBy}
  aria-orientation={orientation === 'vertical' ? 'vertical' : undefined}
  class={classNames('cinder-toolbar', className)}
  data-cinder-orientation={orientation}
  data-cinder-name-source={resolveAccessibleNameSource()}
>
  {@render children()}
</div>
