export type SelectionAnchorPosition = {
  x: number;
  y: number;
};

type SelectionRangeGeometry = Pick<Range, 'getBoundingClientRect' | 'getClientRects'>;

export function getSelectionAnchorRect(range: SelectionRangeGeometry): DOMRect | null {
  const rect =
    Array.from(range.getClientRects()).find((clientRect) => {
      return clientRect.width > 0 && clientRect.height > 0;
    }) ?? range.getBoundingClientRect();

  if (rect.width === 0 && rect.height === 0) return null;
  return rect;
}

export function getSelectionAnchorPosition(
  range: SelectionRangeGeometry,
): SelectionAnchorPosition | null {
  const rect = getSelectionAnchorRect(range);
  if (!rect) return null;

  return {
    x: rect.left + rect.width / 2,
    y: rect.top,
  };
}
