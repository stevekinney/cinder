export type DiffToolbarState = {
  tier: 'realtime' | 'debounced' | 'manual';
  isStale: boolean;
  isComputing: boolean;
  warning: string | null;
  lastComputeTime: number | null;
};

export function hasButtonLabelled(container: HTMLElement, label: string): boolean {
  return Array.from(container.querySelectorAll('button')).some((button) =>
    button.textContent?.includes(label),
  );
}

export function findById(container: HTMLElement, id: string): Element | null {
  return Array.from(container.querySelectorAll('[id]')).find((el) => el.id === id) ?? null;
}
