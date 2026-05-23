import type {
  ResizablePanelDefinition,
  ResizablePanelSize,
  ResizablePanelSizeState,
  ResizablePanelsCollapseTarget,
  ResizablePanelsOrientation,
} from './resizable-panels.types.ts';

type PanelRuntimeState = {
  id: string;
  sizePixels: number;
  restorePixels: number;
  collapsed: boolean;
  preferredUnit: ResizablePanelSize['unit'];
};

export type ResizablePanelsLayoutState = {
  availablePanePixels: number;
  orientation: ResizablePanelsOrientation;
  panels: PanelRuntimeState[];
};

type PanelConstraints = {
  minPixels: number;
  maxPixels: number;
};

type PairAdjustmentOptions = {
  allowCollapsedLeadingMinimum?: boolean;
  allowCollapsedTrailingMinimum?: boolean;
};

export type CollapseResult = {
  state: ResizablePanelsLayoutState;
  changed: boolean;
};

export type ApplyPointerDragResult = {
  axis: number;
  changed: boolean;
  state: ResizablePanelsLayoutState;
};

const DEFAULT_KEYBOARD_STEP: ResizablePanelSize = { value: 10, unit: 'px' };
const DEFAULT_SNAP_THRESHOLD: ResizablePanelSize = { value: 8, unit: 'px' };

function roundToThousandth(value: number): number {
  return Number(value.toFixed(3));
}

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function resolveSizeToPixels(
  size: ResizablePanelSize | undefined,
  availablePanePixels: number,
): number | undefined {
  if (!size) return undefined;
  if (!Number.isFinite(size.value)) return undefined;
  if (size.unit === 'px') return Math.max(0, size.value);
  return Math.max(0, (size.value / 100) * availablePanePixels);
}

export function formatSizeFromPixels(
  pixels: number,
  preferredUnit: ResizablePanelSize['unit'],
  availablePanePixels: number,
): ResizablePanelSize {
  if (preferredUnit === 'px' || availablePanePixels <= 0) {
    return { value: roundToThousandth(pixels), unit: preferredUnit === 'px' ? 'px' : 'percent' };
  }
  return {
    value: roundToThousandth((pixels / availablePanePixels) * 100),
    unit: preferredUnit,
  };
}

function getPreferredUnit(pane: ResizablePanelDefinition): ResizablePanelSize['unit'] {
  return pane.defaultSize?.unit ?? 'percent';
}

function getPanelConstraints(
  panes: ResizablePanelDefinition[],
  availablePanePixels: number,
): PanelConstraints[] {
  return panes.map((pane) => {
    const minimum = resolveSizeToPixels(pane.minSize, availablePanePixels) ?? 0;
    const maximum =
      resolveSizeToPixels(pane.maxSize, availablePanePixels) ?? Number.POSITIVE_INFINITY;
    return {
      minPixels: Math.max(0, minimum),
      maxPixels: Math.max(Math.max(0, minimum), maximum),
    };
  });
}

function distributeDelta(
  sizes: number[],
  targetTotal: number,
  capacities: number[],
  direction: 'grow' | 'shrink',
): number[] {
  const nextSizes = [...sizes];
  let remaining = targetTotal - nextSizes.reduce((sum, value) => sum + value, 0);

  if (Math.abs(remaining) < 0.001) return nextSizes;

  const sign = direction === 'grow' ? 1 : -1;
  let guard = 0;

  while (Math.abs(remaining) > 0.001 && guard < 1000) {
    guard += 1;
    const availableIndexes = capacities
      .map((capacity, index) => ({ capacity, index }))
      .filter(({ capacity }) => capacity > 0.001);

    if (availableIndexes.length === 0) break;

    const totalCapacity = availableIndexes.reduce((sum, item) => sum + item.capacity, 0);
    let consumedThisPass = 0;

    for (const { capacity, index } of availableIndexes) {
      const proportional = (Math.abs(remaining) * capacity) / totalCapacity;
      const slice = Math.min(capacity, proportional || Math.abs(remaining));
      nextSizes[index]! += slice * sign;
      capacities[index]! -= slice;
      consumedThisPass += slice;
      remaining -= slice * sign;
      if (Math.abs(remaining) <= 0.001) break;
    }

    if (consumedThisPass <= 0.001) break;
  }

  return nextSizes;
}

function scaleSizesToTotal(sizes: number[], targetTotal: number): number[] {
  if (targetTotal <= 0) return sizes.map(() => 0);

  const currentTotal = sizes.reduce((sum, value) => sum + value, 0);
  if (currentTotal <= 0) {
    const equalShare = sizes.length > 0 ? targetTotal / sizes.length : 0;
    return sizes.map(() => equalShare);
  }

  const scale = targetTotal / currentTotal;
  return sizes.map((size) => size * scale);
}

function applyCollapsedConstraints(
  constraints: PanelConstraints[],
  collapsedFlags: boolean[],
): PanelConstraints[] {
  return constraints.map((constraint, index) =>
    collapsedFlags[index] ? { minPixels: 0, maxPixels: 0 } : constraint,
  );
}

function normalizeToAvailable(
  desiredSizes: number[],
  constraints: PanelConstraints[],
  availablePanePixels: number,
  collapsedFlags: boolean[] = [],
): number[] {
  const effectiveConstraints = applyCollapsedConstraints(constraints, collapsedFlags);
  const clampedSizes = desiredSizes.map((size, index) =>
    clamp(size, effectiveConstraints[index]!.minPixels, effectiveConstraints[index]!.maxPixels),
  );

  const minimumTotal = effectiveConstraints.reduce(
    (sum, constraint) => sum + constraint.minPixels,
    0,
  );
  if (minimumTotal > availablePanePixels) {
    return scaleSizesToTotal(
      effectiveConstraints.map((constraint) => constraint.minPixels),
      availablePanePixels,
    );
  }

  const currentTotal = clampedSizes.reduce((sum, value) => sum + value, 0);
  if (currentTotal < availablePanePixels) {
    return distributeDelta(
      clampedSizes,
      availablePanePixels,
      effectiveConstraints.map((constraint, index) =>
        Math.max(0, constraint.maxPixels - clampedSizes[index]!),
      ),
      'grow',
    );
  }

  if (currentTotal > availablePanePixels) {
    return distributeDelta(
      clampedSizes,
      availablePanePixels,
      effectiveConstraints.map((constraint, index) =>
        Math.max(0, clampedSizes[index]! - constraint.minPixels),
      ),
      'shrink',
    );
  }

  return clampedSizes;
}

export function validatePanes(panes: ResizablePanelDefinition[]): string[] {
  const issues: string[] = [];
  const seenIds = new Set<string>();
  for (const pane of panes) {
    if (!pane.id.trim()) {
      issues.push('Every pane needs a non-empty id.');
      continue;
    }
    if (seenIds.has(pane.id)) {
      issues.push(`Duplicate pane id "${pane.id}".`);
      continue;
    }
    seenIds.add(pane.id);
    if (pane.defaultCollapsed && !pane.collapsible) {
      issues.push(`Pane "${pane.id}" cannot default to collapsed unless collapsible is true.`);
    }
  }
  return issues;
}

export function createInitialLayoutState(
  panes: ResizablePanelDefinition[],
  availablePanePixels: number,
  orientation: ResizablePanelsOrientation,
): ResizablePanelsLayoutState {
  const constraints = getPanelConstraints(panes, availablePanePixels);
  const equalShare = panes.length > 0 ? availablePanePixels / panes.length : 0;
  const desiredSizes = panes.map(
    (pane) => resolveSizeToPixels(pane.defaultSize, availablePanePixels) ?? equalShare,
  );
  const baseSizes = normalizeToAvailable(desiredSizes, constraints, availablePanePixels);

  const collapsedIndexes = panes
    .map((pane, index) => (pane.defaultCollapsed && pane.collapsible ? index : -1))
    .filter((index) => index >= 0);

  const restorePixels = [...baseSizes];
  const collapsedSizes = [...baseSizes];

  for (const index of collapsedIndexes) {
    collapsedSizes[index] = 0;
  }

  const redistributed = normalizeToAvailable(
    collapsedSizes,
    constraints,
    availablePanePixels,
    panes.map((pane) => Boolean(pane.defaultCollapsed && pane.collapsible)),
  );

  return {
    availablePanePixels,
    orientation,
    panels: panes.map((pane, index) => ({
      id: pane.id,
      sizePixels: redistributed[index] ?? 0,
      restorePixels: restorePixels[index] ?? 0,
      collapsed: collapsedIndexes.includes(index),
      preferredUnit: getPreferredUnit(pane),
    })),
  };
}

export function rebaseLayoutState(
  state: ResizablePanelsLayoutState,
  panes: ResizablePanelDefinition[],
  availablePanePixels: number,
  orientation: ResizablePanelsOrientation,
): ResizablePanelsLayoutState {
  const previousById = new Map(state.panels.map((panel) => [panel.id, panel] as const));
  const constraints = getPanelConstraints(panes, availablePanePixels);
  const fallback = createInitialLayoutState(panes, availablePanePixels, orientation);
  const collapsedFlags = panes.map((pane, index) => {
    const previous = previousById.get(pane.id);
    return previous?.collapsed ?? fallback.panels[index]!.collapsed;
  });

  const desiredSizes = panes.map((pane, index) => {
    const previous = previousById.get(pane.id);
    if (!previous) return fallback.panels[index]!.sizePixels;
    if (previous.collapsed) return 0;
    if (state.availablePanePixels <= 0) return previous.sizePixels;
    return (previous.sizePixels / state.availablePanePixels) * availablePanePixels;
  });

  const normalized = normalizeToAvailable(
    desiredSizes,
    constraints,
    availablePanePixels,
    collapsedFlags,
  );

  return {
    availablePanePixels,
    orientation,
    panels: panes.map((pane, index) => {
      const previous = previousById.get(pane.id);
      const previousRestore = previous?.restorePixels ?? fallback.panels[index]!.restorePixels;
      const collapsed = collapsedFlags[index]!;
      return {
        id: pane.id,
        sizePixels: normalized[index] ?? 0,
        restorePixels:
          state.availablePanePixels > 0
            ? (previousRestore / state.availablePanePixels) * availablePanePixels
            : previousRestore,
        collapsed,
        preferredUnit: getPreferredUnit(pane),
      };
    }),
  };
}

function getPairBounds(
  state: ResizablePanelsLayoutState,
  panes: ResizablePanelDefinition[],
  handleIndex: number,
  options: PairAdjustmentOptions = {},
): {
  pairTotal: number;
  minimumLeading: number;
  maximumLeading: number;
} {
  const constraints = getPanelConstraints(panes, state.availablePanePixels);
  const leading = state.panels[handleIndex]!;
  const trailing = state.panels[handleIndex + 1]!;
  const leadingConstraints = constraints[handleIndex]!;
  const trailingConstraints = constraints[handleIndex + 1]!;
  const pairTotal = leading.sizePixels + trailing.sizePixels;

  const minimumLeading =
    leading.collapsed && options.allowCollapsedLeadingMinimum ? 0 : leadingConstraints.minPixels;
  const trailingMinimum =
    trailing.collapsed && options.allowCollapsedTrailingMinimum ? 0 : trailingConstraints.minPixels;
  const pairMaximumLeading = pairTotal - trailingMinimum;
  const maximumLeading = clamp(
    leadingConstraints.maxPixels,
    minimumLeading,
    Math.max(minimumLeading, pairMaximumLeading),
  );

  return { pairTotal, minimumLeading, maximumLeading };
}

function clonePanels(state: ResizablePanelsLayoutState): PanelRuntimeState[] {
  return state.panels.map((panel) => ({ ...panel }));
}

export function setLeadingPanePixels(
  state: ResizablePanelsLayoutState,
  panes: ResizablePanelDefinition[],
  handleIndex: number,
  leadingPixels: number,
  options: PairAdjustmentOptions = {},
): ResizablePanelsLayoutState {
  const { pairTotal, minimumLeading, maximumLeading } = getPairBounds(
    state,
    panes,
    handleIndex,
    options,
  );
  const panels = clonePanels(state);
  const nextLeading = clamp(leadingPixels, minimumLeading, maximumLeading);
  const nextTrailing = pairTotal - nextLeading;

  panels[handleIndex]!.sizePixels = nextLeading;
  panels[handleIndex]!.collapsed = panes[handleIndex]!.collapsible ? nextLeading === 0 : false;
  if (nextLeading > 0) panels[handleIndex]!.restorePixels = nextLeading;
  panels[handleIndex + 1]!.sizePixels = nextTrailing;
  panels[handleIndex + 1]!.collapsed = panes[handleIndex + 1]!.collapsible
    ? nextTrailing === 0
    : false;
  if (nextTrailing > 0) panels[handleIndex + 1]!.restorePixels = nextTrailing;

  return { ...state, panels };
}

export function applyPairDelta(
  state: ResizablePanelsLayoutState,
  panes: ResizablePanelDefinition[],
  handleIndex: number,
  deltaPixels: number,
): ResizablePanelsLayoutState {
  const leading = state.panels[handleIndex]!;
  return setLeadingPanePixels(state, panes, handleIndex, leading.sizePixels + deltaPixels, {
    allowCollapsedLeadingMinimum: leading.collapsed,
    allowCollapsedTrailingMinimum: state.panels[handleIndex + 1]!.collapsed,
  });
}

function getSnapCandidates(
  state: ResizablePanelsLayoutState,
  panes: ResizablePanelDefinition[],
  handleIndex: number,
): number[] {
  const leadingPane = panes[handleIndex]!;
  const trailingPane = panes[handleIndex + 1]!;
  const pairTotal =
    state.panels[handleIndex]!.sizePixels + state.panels[handleIndex + 1]!.sizePixels;
  const leadingCandidates = (leadingPane.snapPoints ?? [])
    .map((size) => resolveSizeToPixels(size, state.availablePanePixels))
    .filter((value): value is number => value !== undefined)
    .map((value) => clamp(value, 0, pairTotal));
  const trailingCandidates = (trailingPane.snapPoints ?? [])
    .map((size) => resolveSizeToPixels(size, state.availablePanePixels))
    .filter((value): value is number => value !== undefined)
    .map((value) => clamp(pairTotal - value, 0, pairTotal));
  return [...leadingCandidates, ...trailingCandidates];
}

export function applyPairSnap(
  state: ResizablePanelsLayoutState,
  panes: ResizablePanelDefinition[],
  handleIndex: number,
  threshold: ResizablePanelSize = DEFAULT_SNAP_THRESHOLD,
): ResizablePanelsLayoutState {
  const thresholdPixels = resolveSizeToPixels(threshold, state.availablePanePixels) ?? 0;
  const currentLeading = state.panels[handleIndex]!.sizePixels;
  const candidates = getSnapCandidates(state, panes, handleIndex);
  let chosen: number | null = null;
  let chosenDistance = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    const distance = Math.abs(candidate - currentLeading);
    if (distance > thresholdPixels) continue;
    if (distance < chosenDistance) {
      chosen = candidate;
      chosenDistance = distance;
    }
  }

  if (chosen === null) return state;
  return setLeadingPanePixels(state, panes, handleIndex, chosen, {
    allowCollapsedLeadingMinimum: state.panels[handleIndex]!.collapsed,
    allowCollapsedTrailingMinimum: state.panels[handleIndex + 1]!.collapsed,
  });
}

export function applyPointerDragDelta(
  state: ResizablePanelsLayoutState,
  panes: ResizablePanelDefinition[],
  handleIndex: number,
  previousAxis: number,
  currentAxis: number,
  threshold: ResizablePanelSize = DEFAULT_SNAP_THRESHOLD,
): ApplyPointerDragResult {
  const delta = currentAxis - previousAxis;
  if (Math.abs(delta) < 0.001) {
    return { axis: previousAxis, changed: false, state };
  }

  const resized = applyPairDelta(state, panes, handleIndex, delta);
  return {
    axis: currentAxis,
    changed: true,
    state: applyPairSnap(resized, panes, handleIndex, threshold),
  };
}

export function resolveKeyboardStep(
  keyboardStep: ResizablePanelSize | undefined,
  availablePanePixels: number,
  multiplier = 1,
): number {
  return (
    (resolveSizeToPixels(keyboardStep ?? DEFAULT_KEYBOARD_STEP, availablePanePixels) ?? 10) *
    multiplier
  );
}

function chooseCollapseIndex(
  panes: ResizablePanelDefinition[],
  handleIndex: number,
  collapseTarget: ResizablePanelsCollapseTarget,
): number | null {
  const leadingIndex = handleIndex;
  const trailingIndex = handleIndex + 1;
  const leading = panes[leadingIndex]!;
  const trailing = panes[trailingIndex]!;

  if (collapseTarget === 'leading') return leading.collapsible ? leadingIndex : null;
  if (collapseTarget === 'trailing') return trailing.collapsible ? trailingIndex : null;
  if (leading.collapsible) return leadingIndex;
  if (trailing.collapsible) return trailingIndex;
  return null;
}

export function toggleCollapseForHandle(
  state: ResizablePanelsLayoutState,
  panes: ResizablePanelDefinition[],
  handleIndex: number,
  collapseTarget: ResizablePanelsCollapseTarget,
): CollapseResult {
  const targetIndex = chooseCollapseIndex(panes, handleIndex, collapseTarget);
  if (targetIndex === null) return { state, changed: false };

  const oppositeIndex = targetIndex === handleIndex ? handleIndex + 1 : handleIndex;
  const target = state.panels[targetIndex]!;
  const opposite = state.panels[oppositeIndex]!;
  const pairTotal = target.sizePixels + opposite.sizePixels;
  const panels = clonePanels(state);

  if (!target.collapsed) {
    panels[targetIndex]!.restorePixels = target.sizePixels;
    panels[targetIndex]!.sizePixels = 0;
    panels[targetIndex]!.collapsed = true;
    panels[oppositeIndex]!.sizePixels = pairTotal;
    panels[oppositeIndex]!.collapsed = false;
    panels[oppositeIndex]!.restorePixels = pairTotal;
    return { state: { ...state, panels }, changed: true };
  }

  const restored = setLeadingPanePixels(
    { ...state, panels },
    panes,
    handleIndex,
    targetIndex === handleIndex ? target.restorePixels : pairTotal - target.restorePixels,
    {
      allowCollapsedLeadingMinimum: targetIndex === handleIndex,
      allowCollapsedTrailingMinimum: targetIndex !== handleIndex,
    },
  );
  return { state: restored, changed: true };
}

export function getLayoutSnapshot(
  state: ResizablePanelsLayoutState,
  panes: ResizablePanelDefinition[],
): ResizablePanelSizeState[] {
  return panes.map((pane, index) => {
    const runtime = state.panels[index]!;
    const percentage =
      state.availablePanePixels > 0 ? (runtime.sizePixels / state.availablePanePixels) * 100 : 0;
    return {
      id: pane.id,
      size: formatSizeFromPixels(
        runtime.sizePixels,
        runtime.preferredUnit,
        state.availablePanePixels,
      ),
      pixelSize: roundToThousandth(runtime.sizePixels),
      percentage: roundToThousandth(percentage),
      collapsed: runtime.collapsed,
    };
  });
}

export function getHandleAriaState(
  state: ResizablePanelsLayoutState,
  panes: ResizablePanelDefinition[],
  handleIndex: number,
): {
  valueNow: number;
  valueMin: number;
  valueMax: number;
  valueText: string;
} {
  const { pairTotal, minimumLeading, maximumLeading } = getPairBounds(state, panes, handleIndex, {
    allowCollapsedLeadingMinimum: state.panels[handleIndex]!.collapsed,
    allowCollapsedTrailingMinimum: state.panels[handleIndex + 1]!.collapsed,
  });

  if (state.availablePanePixels <= 0 || pairTotal <= 0) {
    return { valueNow: 0, valueMin: 0, valueMax: 100, valueText: '0% (0px)' };
  }

  const currentPixels = state.panels[handleIndex]!.sizePixels;
  const currentPercent = Math.round((currentPixels / state.availablePanePixels) * 100);
  const minimumPercent = Math.round((minimumLeading / state.availablePanePixels) * 100);
  const maximumPercent = Math.round((maximumLeading / state.availablePanePixels) * 100);

  return {
    valueNow: currentPercent,
    valueMin: minimumPercent,
    valueMax: maximumPercent,
    valueText: `${Math.round(currentPixels)}px (${currentPercent}%)`,
  };
}
