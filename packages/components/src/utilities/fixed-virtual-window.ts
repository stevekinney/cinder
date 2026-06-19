export type VirtualListKey = string | number;

export type FixedVirtualWindowItem = {
  readonly index: number;
  readonly key: VirtualListKey;
  readonly start: number;
  readonly size: number;
};

export type FixedVirtualWindow = {
  readonly items: readonly FixedVirtualWindowItem[];
  readonly totalSize: number;
  readonly leadingSize: number;
  readonly trailingSize: number;
  readonly startIndex: number;
  readonly endIndex: number;
};

export type FixedVirtualWindowOptions = {
  itemCount: number;
  itemHeight: number;
  scrollOffset: number;
  viewportHeight: number;
  overscan: number;
  getKey?: (index: number) => VirtualListKey;
};

export function resolveVirtualItemHeight(itemHeight: number, fallback = 1): number {
  if (Number.isFinite(itemHeight) && itemHeight > 0) return itemHeight;
  return fallback;
}

export function resolveVirtualOverscan(overscan: number | undefined): number {
  if (!Number.isFinite(overscan) || overscan === undefined) return 0;
  return Math.max(0, Math.floor(overscan));
}

export function parsePixelLength(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const match = /^([0-9]+(?:\.[0-9]+)?)px$/.exec(value.trim());
  if (!match) return undefined;
  return Number(match[1]);
}

export function getFixedVirtualWindow({
  itemCount,
  itemHeight,
  scrollOffset,
  viewportHeight,
  overscan,
  getKey,
}: FixedVirtualWindowOptions): FixedVirtualWindow {
  const count = Math.max(0, Math.floor(itemCount));
  const size = resolveVirtualItemHeight(itemHeight);
  const totalSize = count * size;

  if (count === 0) {
    return {
      items: [],
      totalSize,
      leadingSize: 0,
      trailingSize: 0,
      startIndex: 0,
      endIndex: 0,
    };
  }

  const resolvedViewportHeight =
    Number.isFinite(viewportHeight) && viewportHeight > 0 ? viewportHeight : size * 10;
  const resolvedOverscan = resolveVirtualOverscan(overscan);
  const maxScrollOffset = Math.max(0, totalSize - resolvedViewportHeight);
  const offset = Math.min(Math.max(0, scrollOffset), maxScrollOffset);
  const visibleStartIndex = Math.min(count - 1, Math.floor(offset / size));
  const visibleCount = Math.max(1, Math.ceil(resolvedViewportHeight / size));
  const startIndex = Math.max(0, visibleStartIndex - resolvedOverscan);
  const endIndex = Math.min(count, startIndex + visibleCount + resolvedOverscan * 2);
  const items = Array.from({ length: endIndex - startIndex }, (_, indexOffset) => {
    const index = startIndex + indexOffset;
    return {
      index,
      key: getKey?.(index) ?? index,
      start: index * size,
      size,
    };
  });
  const firstItem = items[0];
  const lastItem = items.at(-1);
  const leadingSize = firstItem?.start ?? 0;
  const trailingSize = lastItem ? Math.max(0, totalSize - (lastItem.start + lastItem.size)) : 0;

  return {
    items,
    totalSize,
    leadingSize,
    trailingSize,
    startIndex,
    endIndex,
  };
}
