import { describe, expect, test } from 'bun:test';

import {
  applyPairDelta,
  applyPairSnap,
  createInitialLayoutState,
  getHandleAriaState,
  getLayoutSnapshot,
  rebaseLayoutState,
  resolveSizeToPixels,
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

  test('returns separator aria values for the leading pane', () => {
    const state = createInitialLayoutState(panes, 1000, 'horizontal');
    const aria = getHandleAriaState(state, panes, 0);
    expect(aria.valueNow).toBe(25);
    expect(aria.valueText).toContain('250px');
  });
});
