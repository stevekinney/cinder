import { describe, expect, test } from 'bun:test';
import {
  dragRegionClass,
  dragRegionProps,
  noDragClass,
  noDragProps,
  safeHeaderDragStyle,
} from './drag-region.ts';

describe('drag region utilities', () => {
  test('are no-ops on web', () => {
    expect(dragRegionProps('web')).toEqual({});
    expect(noDragProps('web')).toEqual({});
  });
  test('punch interactive descendants out of a desktop drag region', () => {
    expect(dragRegionProps('macos')).toEqual({ class: dragRegionClass });
    expect(noDragProps('macos')).toEqual({ class: noDragClass });
  });
  test('safe header defaults are token-fed', () => {
    expect(safeHeaderDragStyle).toContain('--_cinder-safe-header-left, 0px');
    expect(safeHeaderDragStyle).toContain('--_cinder-safe-header-right, 0px');
  });

  test('shared CSS covers both drag properties and interactive descendants', async () => {
    const css = await Bun.file(new URL('../styles/utilities.css', import.meta.url)).text();
    expect(css).toContain('-webkit-app-region: drag');
    expect(css).toContain('app-region: drag');
    expect(css).toContain("[role='button']");
    expect(css).toContain("[tabindex]:not([tabindex='-1'])");
    expect(css).toContain("[contenteditable]:not([contenteditable='false' i])");
    expect(css).not.toContain("[contenteditable='true']");
  });
});
