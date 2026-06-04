/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import {
  getSelectionAnchorPosition,
  getSelectionAnchorRect,
} from './review-editor-selection-geometry.ts';

function createRect(x: number, y: number, width: number, height: number): DOMRect {
  return {
    x,
    y,
    width,
    height,
    top: y,
    left: x,
    right: x + width,
    bottom: y + height,
    toJSON: () => ({ x, y, width, height }),
  } as DOMRect;
}

function createRectList(rects: DOMRect[]): DOMRectList {
  return Object.assign(rects, {
    item: (index: number) => rects[index] ?? null,
  }) as unknown as DOMRectList;
}

function createRangeGeometry(clientRects: DOMRect[], boundingRect: DOMRect) {
  return {
    getClientRects: () => createRectList(clientRects),
    getBoundingClientRect: () => boundingRect,
  };
}

describe('ReviewEditor selection geometry', () => {
  test('uses the first visible client rect for multi-line selections', () => {
    const firstLineRect = createRect(20, 40, 120, 18);
    const secondLineRect = createRect(10, 62, 240, 18);
    const boundingRect = createRect(10, 40, 250, 40);

    const rect = getSelectionAnchorRect(
      createRangeGeometry([createRect(0, 0, 0, 0), firstLineRect, secondLineRect], boundingRect),
    );

    expect(rect).toBe(firstLineRect);
  });

  test('falls back to the bounding rect when no visible client rect exists', () => {
    const boundingRect = createRect(12, 24, 80, 16);

    expect(getSelectionAnchorRect(createRangeGeometry([], boundingRect))).toBe(boundingRect);
  });

  test('returns null for empty selection geometry', () => {
    const rect = getSelectionAnchorRect(
      createRangeGeometry([createRect(0, 0, 0, 0)], createRect(0, 0, 0, 0)),
    );

    expect(rect).toBeNull();
  });

  test('centers the anchor on the selected visual line', () => {
    const position = getSelectionAnchorPosition(
      createRangeGeometry([createRect(20, 40, 120, 18)], createRect(20, 40, 120, 18)),
    );

    expect(position).toEqual({ x: 80, y: 40 });
  });
});
