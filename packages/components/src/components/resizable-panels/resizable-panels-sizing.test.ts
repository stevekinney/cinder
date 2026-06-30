import { describe, expect, test } from 'bun:test';

import {
  applyPairDelta,
  applyPairSnap,
  applyPointerDragDelta,
  createInitialLayoutState,
  formatSizeFromPixels,
  getHandleAriaState,
  getLayoutSnapshot,
  getPaneDefaultSizeSignature,
  getPaneLayoutSignature,
  hasLayoutPixelChanges,
  rebaseLayoutState,
  resolveKeyboardStep,
  resolveSizeToPixels,
  setLeadingPanePixels,
  toggleCollapseForHandle,
  validatePanes,
} from './resizable-panels-sizing.ts';
import type { ResizablePanelDefinition } from './resizable-panels.types.ts';

const panes: ResizablePanelDefinition[] = [
  {
    id: 'left',
    label: 'Left',
    defaultSize: { value: 25, unit: 'percent' },
    minSize: { value: 100, unit: 'px' },
    snapPoints: [{ value: 20, unit: 'percent' }],
    collapsible: true,
  },
  {
    id: 'center',
    label: 'Center',
    defaultSize: { value: 50, unit: 'percent' },
    minSize: { value: 20, unit: 'percent' },
  },
  {
    id: 'right',
    label: 'Right',
    defaultSize: { value: 25, unit: 'percent' },
    minSize: { value: 120, unit: 'px' },
  },
];

describe('resizable-panels sizing', () => {
  test('validates duplicate ids', () => {
    const issues = validatePanes([
      { id: 'dup', label: 'One' },
      { id: 'dup', label: 'Two' },
    ]);
    expect(issues).toHaveLength(1);
  });

  test('validates pane ids and collapse configuration', () => {
    const issues = validatePanes([
      { id: ' ', label: 'Missing' },
      { id: 'closed', label: 'Closed', defaultCollapsed: true },
    ]);

    expect(issues).toEqual([
      'Every pane needs a non-empty id.',
      'Pane "closed" cannot default to collapsed unless collapsible is true.',
    ]);
  });

  test('resolves percent sizes to pixels', () => {
    expect(resolveSizeToPixels({ value: 25, unit: 'percent' }, 800)).toBe(200);
  });

  test('creates an initial measured layout', () => {
    const state = createInitialLayoutState(panes, 1000, 'horizontal');
    expect(state.panels).toHaveLength(3);
    expect(state.panels.reduce((sum, panel) => sum + panel.sizePixels, 0)).toBeCloseTo(1000, 3);
  });

  test('rebases to a larger container while preserving proportions', () => {
    const state = createInitialLayoutState(panes, 1000, 'horizontal');
    const rebased = rebaseLayoutState(state, panes, 1200, 'horizontal');
    expect(rebased.panels[0]!.sizePixels).toBeCloseTo(300, 1);
    expect(rebased.panels.reduce((sum, panel) => sum + panel.sizePixels, 0)).toBeCloseTo(1200, 3);
  });

  test('can rebase from updated default sizes', () => {
    const state = createInitialLayoutState(panes, 1000, 'horizontal');
    const updatedPanes = [
      { ...panes[0]!, defaultSize: { value: 40, unit: 'percent' } },
      { ...panes[1]!, defaultSize: { value: 35, unit: 'percent' } },
      panes[2]!,
    ] satisfies ResizablePanelDefinition[];

    const rebased = rebaseLayoutState(state, updatedPanes, 1000, 'horizontal', {
      useDefaultSizes: true,
    });

    expect(getPaneDefaultSizeSignature(updatedPanes)).not.toBe(getPaneDefaultSizeSignature(panes));
    expect(rebased.panels[0]!.sizePixels).toBeCloseTo(400, 1);
    expect(rebased.panels[1]!.sizePixels).toBeCloseTo(350, 1);
    expect(rebased.panels[2]!.sizePixels).toBeCloseTo(250, 1);
  });

  test('rebases through a zero-pixel budget without preserving stale sizes', () => {
    const state = createInitialLayoutState(panes, 1000, 'horizontal');
    const zeroBudget = rebaseLayoutState(state, panes, 0, 'horizontal');
    const restored = rebaseLayoutState(zeroBudget, panes, 1000, 'horizontal');

    expect(zeroBudget.availablePanePixels).toBe(0);
    expect(zeroBudget.panels.map((panel) => panel.sizePixels)).toEqual([0, 0, 0]);
    expect(restored.panels[0]!.sizePixels).toBeCloseTo(250, 1);
    expect(restored.panels[1]!.sizePixels).toBeCloseTo(500, 1);
    expect(restored.panels[2]!.sizePixels).toBeCloseTo(250, 1);
  });

  test('resizes only the active adjacent pair', () => {
    const state = createInitialLayoutState(panes, 1000, 'horizontal');
    const next = applyPairDelta(state, panes, 0, 100);
    expect(next.panels[0]!.sizePixels).toBeCloseTo(350, 1);
    expect(next.panels[1]!.sizePixels).toBeCloseTo(400, 1);
    expect(next.panels[2]!.sizePixels).toBeCloseTo(250, 1);
  });

  test('applies snap points when within threshold', () => {
    const state = createInitialLayoutState(panes, 1000, 'horizontal');
    const resized = applyPairDelta(state, panes, 0, -45);
    const snapped = applyPairSnap(resized, panes, 0, { value: 10, unit: 'percent' });
    expect(snapped.panels[0]!.sizePixels).toBeCloseTo(200, 1);
  });

  test('applies trailing pane snap points against the adjacent pair total', () => {
    const trailingSnapPanes: ResizablePanelDefinition[] = [
      {
        id: 'left',
        label: 'Left',
        defaultSize: { value: 50, unit: 'percent' },
      },
      {
        id: 'right',
        label: 'Right',
        defaultSize: { value: 50, unit: 'percent' },
        snapPoints: [{ value: 30, unit: 'percent' }],
      },
    ];
    const state = createInitialLayoutState(trailingSnapPanes, 1000, 'horizontal');
    const resized = applyPairDelta(state, trailingSnapPanes, 0, 185);
    const snapped = applyPairSnap(resized, trailingSnapPanes, 0, { value: 20, unit: 'px' });

    expect(snapped.panels[0]!.sizePixels).toBeCloseTo(700, 1);
    expect(snapped.panels[1]!.sizePixels).toBeCloseTo(300, 1);
  });

  test('collapses and restores the chosen pane', () => {
    const state = createInitialLayoutState(panes, 1000, 'horizontal');
    const collapsed = toggleCollapseForHandle(state, panes, 0, 'leading');
    expect(collapsed.changed).toBe(true);
    expect(collapsed.state.panels[0]!.sizePixels).toBe(0);
    const restored = toggleCollapseForHandle(collapsed.state, panes, 0, 'leading');
    expect(restored.state.panels[0]!.sizePixels).toBeGreaterThan(0);
  });

  test('produces layout snapshots with structured sizes', () => {
    const state = createInitialLayoutState(panes, 1000, 'horizontal');
    const snapshot = getLayoutSnapshot(state, panes);
    expect(snapshot[0]!.size.unit).toBe('percent');
    expect(snapshot[0]!.percentage).toBeCloseTo(25, 1);
  });

  test('formats percent sizes as zero percent when the measured budget is zero', () => {
    expect(formatSizeFromPixels(48, 'percent', 0)).toEqual({ value: 0, unit: 'percent' });
  });

  test('formats pixel sizes without converting units', () => {
    expect(formatSizeFromPixels(48.1234, 'px', 1000)).toEqual({ value: 48.123, unit: 'px' });
  });

  test('returns separator aria values for the leading adjacent pane pair', () => {
    const state = createInitialLayoutState(panes, 1000, 'horizontal');
    const aria = getHandleAriaState(state, panes, 0);
    expect(aria.valueNow).toBe(33);
    expect(aria.valueText).toContain('250px');
  });

  test('returns separator aria values relative to the adjacent pane pair', () => {
    const state = createInitialLayoutState(panes, 1000, 'horizontal');
    const aria = getHandleAriaState(state, panes, 1);
    expect(aria.valueNow).toBe(67);
    expect(aria.valueText).toContain('500px');
  });

  test('returns unmeasured separator aria values for a zero pixel budget', () => {
    const state = createInitialLayoutState(panes, 0, 'horizontal');
    expect(getHandleAriaState(state, panes, 0)).toEqual({
      valueNow: 0,
      valueMin: 0,
      valueMax: 100,
      valueText: '0px (0%)',
    });
  });

  test('scales impossible minimum totals back into the available budget', () => {
    const constrainedPanes: ResizablePanelDefinition[] = [
      { id: 'left', label: 'Left', minSize: { value: 300, unit: 'px' } },
      { id: 'right', label: 'Right', minSize: { value: 300, unit: 'px' } },
    ];

    const state = createInitialLayoutState(constrainedPanes, 400, 'horizontal');

    expect(state.panels.reduce((sum, panel) => sum + panel.sizePixels, 0)).toBeCloseTo(400, 3);
    expect(state.panels[0]!.sizePixels).toBeCloseTo(200, 3);
    expect(state.panels[1]!.sizePixels).toBeCloseTo(200, 3);
  });

  test('keeps collapsed panes at zero while redistributing the remaining space', () => {
    const collapsiblePanes: ResizablePanelDefinition[] = [
      {
        id: 'left',
        label: 'Left',
        defaultSize: { value: 25, unit: 'percent' },
        minSize: { value: 120, unit: 'px' },
        collapsible: true,
        defaultCollapsed: true,
      },
      { id: 'right', label: 'Right', defaultSize: { value: 75, unit: 'percent' } },
    ];

    const state = createInitialLayoutState(collapsiblePanes, 800, 'horizontal');
    const rebased = rebaseLayoutState(state, collapsiblePanes, 500, 'horizontal');

    expect(state.panels[0]!.sizePixels).toBe(0);
    expect(state.panels[1]!.sizePixels).toBeCloseTo(800, 3);
    expect(rebased.panels[0]!.sizePixels).toBe(0);
    expect(rebased.panels[1]!.sizePixels).toBeCloseTo(500, 3);
  });

  test('does not mark non-collapsible panes as collapsed when they reach zero pixels', () => {
    const nonCollapsiblePanes: ResizablePanelDefinition[] = [
      { id: 'left', label: 'Left', minSize: { value: 0, unit: 'px' } },
      { id: 'right', label: 'Right', minSize: { value: 0, unit: 'px' } },
    ];

    const state = createInitialLayoutState(nonCollapsiblePanes, 600, 'horizontal');
    const resized = setLeadingPanePixels(state, nonCollapsiblePanes, 0, 0);

    expect(resized.panels[0]!.sizePixels).toBe(0);
    expect(resized.panels[0]!.collapsed).toBe(false);
  });

  test('applies pointer deltas against the rebased live layout state', () => {
    const initial = createInitialLayoutState(panes, 800, 'horizontal');
    const rebased = rebaseLayoutState(initial, panes, 400, 'horizontal');
    const dragged = applyPointerDragDelta(rebased, panes, 0, 200, 250, {
      value: 0,
      unit: 'px',
    });

    expect(dragged.changed).toBe(true);
    expect(dragged.state.panels[0]!.sizePixels).toBeCloseTo(150, 3);
    expect(dragged.state.panels[1]!.sizePixels).toBeCloseTo(130, 3);
  });

  test('keeps the pointer axis and layout unchanged for zero delta drags', () => {
    const state = createInitialLayoutState(panes, 1000, 'horizontal');
    const dragged = applyPointerDragDelta(state, panes, 0, 200, 200);

    expect(dragged).toEqual({ axis: 200, changed: false, state });
  });

  test('resolves keyboard steps from custom and default sizes', () => {
    expect(resolveKeyboardStep({ value: 5, unit: 'percent' }, 800, 2)).toBe(80);
    expect(resolveKeyboardStep(undefined, 800, 3)).toBe(30);
  });

  test('respects maxSize while resizing an adjacent pair', () => {
    const maxConstrainedPanes: ResizablePanelDefinition[] = [
      {
        id: 'left',
        label: 'Left',
        defaultSize: { value: 50, unit: 'percent' },
        minSize: { value: 100, unit: 'px' },
        maxSize: { value: 220, unit: 'px' },
      },
      {
        id: 'right',
        label: 'Right',
        defaultSize: { value: 50, unit: 'percent' },
        minSize: { value: 100, unit: 'px' },
      },
    ] satisfies ResizablePanelDefinition[];

    const state = createInitialLayoutState(maxConstrainedPanes, 600, 'horizontal');
    const resized = applyPairDelta(state, maxConstrainedPanes, 0, 200);

    expect(resized.panels[0]!.sizePixels).toBe(220);
    expect(resized.panels[1]!.sizePixels).toBe(380);
  });

  test('fills the available budget when every pane is max constrained', () => {
    const maxConstrainedPanes: ResizablePanelDefinition[] = [
      {
        id: 'left',
        label: 'Left',
        defaultSize: { value: 100, unit: 'px' },
        maxSize: { value: 120, unit: 'px' },
      },
      {
        id: 'right',
        label: 'Right',
        defaultSize: { value: 100, unit: 'px' },
        maxSize: { value: 120, unit: 'px' },
      },
    ];

    const state = createInitialLayoutState(maxConstrainedPanes, 600, 'horizontal');

    expect(state.panels.reduce((sum, panel) => sum + panel.sizePixels, 0)).toBeCloseTo(600, 3);
    expect(state.panels[0]!.sizePixels).toBeCloseTo(300, 3);
    expect(state.panels[1]!.sizePixels).toBeCloseTo(300, 3);
  });

  test('distributes budget evenly when every finite max constraint is zero', () => {
    const maxConstrainedPanes: ResizablePanelDefinition[] = [
      {
        id: 'left',
        label: 'Left',
        maxSize: { value: 0, unit: 'px' },
      },
      {
        id: 'right',
        label: 'Right',
        maxSize: { value: 0, unit: 'px' },
      },
    ];

    const state = createInitialLayoutState(maxConstrainedPanes, 600, 'horizontal');

    expect(state.panels.reduce((sum, panel) => sum + panel.sizePixels, 0)).toBeCloseTo(600, 3);
    expect(state.panels[0]!.sizePixels).toBeCloseTo(300, 3);
    expect(state.panels[1]!.sizePixels).toBeCloseTo(300, 3);
  });

  test('keeps every default-collapsed pane at zero', () => {
    const collapsedPanes: ResizablePanelDefinition[] = [
      {
        id: 'left',
        label: 'Left',
        collapsible: true,
        defaultCollapsed: true,
      },
      {
        id: 'right',
        label: 'Right',
        collapsible: true,
        defaultCollapsed: true,
      },
    ];

    const state = createInitialLayoutState(collapsedPanes, 600, 'horizontal');

    expect(state.panels.map((panel) => panel.sizePixels)).toEqual([0, 0]);
    expect(state.panels.map((panel) => panel.collapsed)).toEqual([true, true]);
  });

  test('rebases finite max constraints across the full available budget', () => {
    const maxConstrainedPanes: ResizablePanelDefinition[] = [
      {
        id: 'left',
        label: 'Left',
        defaultSize: { value: 80, unit: 'px' },
        maxSize: { value: 120, unit: 'px' },
      },
      {
        id: 'center',
        label: 'Center',
        defaultSize: { value: 80, unit: 'px' },
        maxSize: { value: 120, unit: 'px' },
      },
      {
        id: 'right',
        label: 'Right',
        defaultSize: { value: 80, unit: 'px' },
        maxSize: { value: 120, unit: 'px' },
      },
    ];

    const state = createInitialLayoutState(maxConstrainedPanes, 900, 'horizontal');

    expect(state.panels.map((panel) => panel.sizePixels)).toEqual([300, 300, 300]);
  });

  test('respects the opposite pane maxSize while collapsing', () => {
    const maxConstrainedPanes: ResizablePanelDefinition[] = [
      {
        id: 'left',
        label: 'Left',
        defaultSize: { value: 400, unit: 'px' },
        minSize: { value: 0, unit: 'px' },
        collapsible: true,
      },
      {
        id: 'right',
        label: 'Right',
        defaultSize: { value: 200, unit: 'px' },
        minSize: { value: 100, unit: 'px' },
        maxSize: { value: 220, unit: 'px' },
      },
    ];

    const state = createInitialLayoutState(maxConstrainedPanes, 600, 'horizontal');
    const collapsed = toggleCollapseForHandle(state, maxConstrainedPanes, 0, 'leading');

    expect(collapsed.changed).toBe(true);
    expect(collapsed.state.panels[0]!.sizePixels).toBe(380);
    expect(collapsed.state.panels[0]!.collapsed).toBe(false);
    expect(collapsed.state.panels[1]!.sizePixels).toBe(220);
  });

  test('collapses the trailing pane when requested from a handle', () => {
    const trailingCollapsiblePanes: ResizablePanelDefinition[] = [
      {
        id: 'left',
        label: 'Left',
        defaultSize: { value: 50, unit: 'percent' },
      },
      {
        id: 'right',
        label: 'Right',
        defaultSize: { value: 50, unit: 'percent' },
        minSize: { value: 0, unit: 'px' },
        collapsible: true,
      },
    ];

    const state = createInitialLayoutState(trailingCollapsiblePanes, 600, 'horizontal');
    const collapsed = toggleCollapseForHandle(state, trailingCollapsiblePanes, 0, 'trailing');

    expect(collapsed.changed).toBe(true);
    expect(collapsed.state.panels[0]!.sizePixels).toBe(600);
    expect(collapsed.state.panels[1]!.sizePixels).toBe(0);
    expect(collapsed.state.panels[1]!.collapsed).toBe(true);
  });

  test('uses the trailing pane as the automatic collapse target when leading is not collapsible', () => {
    const trailingCollapsiblePanes: ResizablePanelDefinition[] = [
      {
        id: 'left',
        label: 'Left',
        defaultSize: { value: 50, unit: 'percent' },
      },
      {
        id: 'right',
        label: 'Right',
        defaultSize: { value: 50, unit: 'percent' },
        minSize: { value: 0, unit: 'px' },
        collapsible: true,
      },
    ];

    const state = createInitialLayoutState(trailingCollapsiblePanes, 600, 'horizontal');
    const collapsed = toggleCollapseForHandle(
      state,
      trailingCollapsiblePanes,
      0,
      'nearest-collapsible',
    );

    expect(collapsed.changed).toBe(true);
    expect(collapsed.state.panels[1]!.collapsed).toBe(true);
  });

  test('reports no pointer change when constraints keep the layout fixed', () => {
    const maxConstrainedPanes: ResizablePanelDefinition[] = [
      {
        id: 'left',
        label: 'Left',
        defaultSize: { value: 50, unit: 'percent' },
        minSize: { value: 100, unit: 'px' },
        maxSize: { value: 220, unit: 'px' },
      },
      {
        id: 'right',
        label: 'Right',
        defaultSize: { value: 50, unit: 'percent' },
        minSize: { value: 100, unit: 'px' },
      },
    ];

    const state = createInitialLayoutState(maxConstrainedPanes, 600, 'horizontal');
    const constrained = applyPairDelta(state, maxConstrainedPanes, 0, 200);
    const dragged = applyPointerDragDelta(constrained, maxConstrainedPanes, 0, 200, 260);

    expect(constrained.panels[0]!.sizePixels).toBe(220);
    expect(dragged.changed).toBe(false);
    expect(dragged.state).toBe(constrained);
  });

  test('compares layout pixel changes after constraints and snapping', () => {
    const state = createInitialLayoutState(panes, 1000, 'horizontal');
    const resized = applyPairDelta(state, panes, 0, 100);

    expect(hasLayoutPixelChanges(state, state)).toBe(false);
    expect(hasLayoutPixelChanges(state, resized)).toBe(true);
  });

  test('changes pane layout signature when constraints change without changing pane ids', () => {
    const initialSignature = getPaneLayoutSignature(panes);
    const updatedSignature = getPaneLayoutSignature([
      {
        ...panes[0]!,
        maxSize: { value: 120, unit: 'px' },
      },
      panes[1]!,
      panes[2]!,
    ]);

    expect(updatedSignature).not.toBe(initialSignature);
  });
});
