export function clampNavigationIndex(index: number, count: number): number {
  if (count <= 0) return -1;
  return Math.min(count - 1, Math.max(0, Math.trunc(index)));
}

export function navigationIndexFromPointer(
  clientY: number,
  bounds: ReadonlyArray<{ top: number; bottom: number }>,
): number {
  if (bounds.length === 0) return -1;
  const first = bounds[0]!;
  const last = bounds[bounds.length - 1]!;
  if (clientY <= first.top) return 0;
  if (clientY >= last.bottom) return bounds.length - 1;
  return bounds.findIndex(({ top, bottom }) => clientY >= top && clientY <= bottom);
}

export function navigationScrollFromPointer(
  clientY: number,
  top: number,
  height: number,
  maximumScroll: number,
): number {
  if (height <= 0 || maximumScroll <= 0) return 0;
  const progress = Math.min(1, Math.max(0, (clientY - top) / height));
  return progress * maximumScroll;
}
