import { on } from 'svelte/events';

import { computeToolbarOverflow, resolveFocusPinnedOverflow } from './toolbar-overflow.ts';

export type FlexGroupId = 'leading' | 'text-formatting' | 'links' | 'lists' | 'block-operations';

type ToolbarElements = {
  leading: HTMLDivElement | null;
  trailing: HTMLDivElement | null;
  triggerGhost: HTMLDivElement | null;
  actionsMeasure: HTMLDivElement | null;
  groups: Record<FlexGroupId, HTMLDivElement | null>;
};

const flexGroupOrder: readonly FlexGroupId[] = [
  'leading',
  'text-formatting',
  'links',
  'lists',
  'block-operations',
];

function isFlexGroupId(value: string | undefined): value is FlexGroupId {
  return value !== undefined && (flexGroupOrder as readonly string[]).includes(value);
}

function isOverflowTrigger(toolbarInstanceId: string, target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    target.closest<HTMLElement>('button[aria-label="More formatting"]')?.dataset[
      'toolbarInstanceId'
    ] === toolbarInstanceId
  );
}

function flexGroupIdFromTarget(
  toolbarInstanceId: string,
  target: EventTarget | null,
): FlexGroupId | null {
  if (!(target instanceof HTMLElement)) return null;
  const chunk = target.closest<HTMLElement>('[data-toolbar-flex-group-id]');
  if (chunk?.dataset['toolbarInstanceId'] !== toolbarInstanceId) return null;
  const value = chunk.dataset['toolbarFlexGroupId'];
  return isFlexGroupId(value) ? value : null;
}

/** Owns toolbar measurement, overflow, and focus placement state. */
export class ToolbarOverflowController {
  private containerWidth = $state<number | null>(null);
  private gap = $state(0);
  private triggerWidth = $state(0);
  private actionsReservedWidth = $state(0);
  private groupWidths = $state<Record<FlexGroupId, number>>({
    leading: 0,
    'text-formatting': 0,
    links: 0,
    lists: 0,
    'block-operations': 0,
  });
  private focusedGroupId = $state<FlexGroupId | null>(null);
  private focusedGroupWasOverflowing = $state(false);
  private overflowSetPinnedByTrigger = $state<string[] | null>(null);
  private toolbarResizeObserver: ResizeObserver | null = null;
  private remeasureTrailingReservation: (() => void) | null = null;

  private readonly rawOverflowGroupIds = $derived.by(
    () =>
      computeToolbarOverflow({
        availableWidth:
          this.containerWidth === null ? null : this.containerWidth - this.actionsReservedWidth,
        gap: this.gap,
        triggerWidth: this.triggerWidth,
        groups: flexGroupOrder.map((id) => ({ id, width: this.groupWidths[id] })),
      }).overflowGroupIds,
  );

  readonly overflowGroupIds = $derived.by(() =>
    resolveFocusPinnedOverflow({
      rawOverflowGroupIds: this.rawOverflowGroupIds,
      overflowSetPinnedByTrigger: this.overflowSetPinnedByTrigger,
      focusedGroupId: this.focusedGroupId,
      focusedGroupWasOverflowing: this.focusedGroupWasOverflowing,
    }),
  );

  constructor(
    private readonly toolbarInstanceId: string,
    private readonly getElements: () => ToolbarElements,
  ) {}

  setLeadingElement(element: HTMLDivElement | null): () => void {
    if (element) {
      const width = element.getBoundingClientRect().width;
      if (width > 0 || this.groupWidths.leading === 0) {
        this.groupWidths = { ...this.groupWidths, leading: width };
      }
    }
    const observer = this.toolbarResizeObserver;
    if (element) observer?.observe(element);
    return () => {
      if (element) observer?.unobserve(element);
    };
  }

  setActionsElement(element: HTMLDivElement | null, hasActions: boolean): () => void {
    if (!hasActions || !element) {
      this.actionsReservedWidth = 0;
      return () => {};
    }
    this.remeasureTrailingReservation?.();
    this.toolbarResizeObserver?.observe(element);
    return () => this.toolbarResizeObserver?.unobserve(element);
  }

  private focusHandlers(
    isTrigger: (target: EventTarget | null) => boolean,
    groupFromTarget: (target: EventTarget | null) => FlexGroupId | null,
  ): { handleFocusIn: (event: FocusEvent) => void; handleFocusOut: (event: FocusEvent) => void } {
    const handleFocusIn = (event: FocusEvent) => {
      if (isTrigger(event.target)) {
        this.overflowSetPinnedByTrigger = [...this.overflowGroupIds];
        this.focusedGroupId = null;
        return;
      }
      const groupId = groupFromTarget(event.target);
      if (!groupId) {
        this.overflowSetPinnedByTrigger = null;
        return;
      }
      if (this.focusedGroupId === groupId) return;
      this.focusedGroupWasOverflowing = this.overflowGroupIds.includes(groupId);
      this.overflowSetPinnedByTrigger = null;
      this.focusedGroupId = groupId;
    };
    const handleFocusOut = (event: FocusEvent) => {
      if (isTrigger(event.relatedTarget)) return;
      const nextGroupId = groupFromTarget(event.relatedTarget);
      if (nextGroupId !== this.focusedGroupId) this.focusedGroupId = null;
      if (nextGroupId === null) this.overflowSetPinnedByTrigger = null;
    };
    return { handleFocusIn, handleFocusOut };
  }

  private measurementHandlers(node: HTMLElement): {
    readGap: () => number;
    measureActions: () => void;
    measureGroups: () => void;
  } {
    const elements = this.getElements;
    const readGap = () => {
      const value = Number.parseFloat(getComputedStyle(node).columnGap || '0');
      return Number.isFinite(value) ? value : 0;
    };
    const measureActions = () => {
      const { actionsMeasure } = elements();
      if (!actionsMeasure) {
        this.actionsReservedWidth = 0;
        return;
      }
      const width = actionsMeasure.getBoundingClientRect().width;
      const minimum = Number.parseFloat(
        getComputedStyle(elements().trailing ?? actionsMeasure).minWidth || '0',
      );
      this.actionsReservedWidth = this.gap + Math.max(minimum, width);
    };
    const measureGroups = () => {
      const next = { ...this.groupWidths };
      let changed = false;
      for (const id of flexGroupOrder) {
        if (next[id] !== 0) continue;
        const element = elements().groups[id];
        const width = element?.getBoundingClientRect().width ?? 0;
        if (width > 0) {
          next[id] = width;
          changed = true;
        }
      }
      if (changed) this.groupWidths = next;
    };
    return { readGap, measureActions, measureGroups };
  }

  private createObserver(
    node: HTMLElement,
    measureActions: () => void,
    measureGroups: () => void,
  ): ResizeObserver | null {
    const elements = this.getElements;
    const Constructor =
      node.ownerDocument === document
        ? globalThis.ResizeObserver
        : node.ownerDocument.defaultView?.ResizeObserver;
    if (typeof Constructor !== 'function') return null;
    return new Constructor((entries) => {
      for (const entry of entries) {
        const current = elements();
        if (entry.target === node) this.containerWidth = entry.contentRect.width;
        else if (entry.target === current.leading)
          this.groupWidths = { ...this.groupWidths, leading: entry.contentRect.width };
        else if (entry.target === current.actionsMeasure) measureActions();
      }
      measureGroups();
    });
  }

  attach(node: HTMLElement): () => void {
    const elements = this.getElements;
    const { readGap, measureActions, measureGroups } = this.measurementHandlers(node);
    const { handleFocusIn, handleFocusOut } = this.focusHandlers(
      (target) => isOverflowTrigger(this.toolbarInstanceId, target),
      (target) => flexGroupIdFromTarget(this.toolbarInstanceId, target),
    );

    this.gap = readGap();
    const leadingWidth = elements().leading?.getBoundingClientRect().width ?? 0;
    if (leadingWidth > 0 || this.groupWidths.leading === 0) {
      this.groupWidths = { ...this.groupWidths, leading: leadingWidth };
    }
    this.triggerWidth = elements().triggerGhost?.getBoundingClientRect().width ?? 0;
    measureActions();
    measureGroups();
    const listenerRoot = node.ownerDocument;
    const removeFocusIn = on(listenerRoot, 'focusin', handleFocusIn);
    const removeFocusOut = on(listenerRoot, 'focusout', handleFocusOut);
    const observer = this.createObserver(node, measureActions, measureGroups);
    this.toolbarResizeObserver = observer;
    this.remeasureTrailingReservation = measureActions;
    observer?.observe(node);
    const leading = elements().leading;
    if (leading) observer?.observe(leading);
    const actionsMeasure = elements().actionsMeasure;
    if (actionsMeasure) observer?.observe(actionsMeasure);

    return () => {
      removeFocusIn();
      removeFocusOut();
      observer?.disconnect();
      if (this.toolbarResizeObserver === observer) this.toolbarResizeObserver = null;
      this.remeasureTrailingReservation = null;
    };
  }
}
