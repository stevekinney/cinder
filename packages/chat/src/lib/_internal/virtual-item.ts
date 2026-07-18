/** Minimal virtual-row geometry used by Chat's package-local virtualizer. */
export type VirtualItem = {
  key: string | number | bigint;
  index: number;
  start: number;
  end: number;
  size: number;
  lane: number;
};
