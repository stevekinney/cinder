import type { VirtualListKey } from '../../../utilities/fixed-virtual-window.ts';
import type { MeasurementCorrection } from './measurement-window.ts';

/**
 * Reactive cache of real, ResizeObserver-measured row sizes for `dynamicSize`
 * VirtualList mode, plus a queue of the scroll corrections those
 * measurements imply.
 *
 * Deliberately backed by a plain `Map`, not `SvelteMap`: consumers (the
 * component's `offsets` `$derived`) drive their recomputation off the
 * `version` counter below, so the map itself does not need per-key
 * reactivity — and a plain `Map` avoids per-key subscription overhead on a
 * list with tens of thousands of rows.
 */
export class VirtualListMeasurementStore {
  #sizes = new Map<VirtualListKey, number>();
  #pendingCorrections: MeasurementCorrection[] = [];
  #version = $state(0);
  #pendingCorrectionsVersion = $state(0);

  /** Bumped whenever a cached size actually changes. Drive buildVirtualOffsets's $derived off this. */
  get version(): number {
    return this.#version;
  }

  /** Bumped whenever a non-zero-delta correction is queued. Drive the anchor-correction $effect.pre off this. */
  get pendingCorrectionsVersion(): number {
    return this.#pendingCorrectionsVersion;
  }

  /** Live, read-only view of the measured-size cache, keyed by row key. */
  get sizes(): ReadonlyMap<VirtualListKey, number> {
    // Touch #version so a $derived that reads only `.sizes` (never `.version`
    // directly) still re-runs whenever the cache mutates.
    void this.#version;
    return this.#sizes;
  }

  /**
   * Records a ResizeObserver measurement. No-ops (no version bump, no queued
   * correction) when the rounded size is unchanged from what's cached — this
   * is what stops a measurement feedback loop, since writing the corrected
   * scroll offset re-lays-out rows that then report the same size back.
   *
   * The queued correction's delta is measured against whatever the offsets
   * table already assumed for this row: `estimateSize` on a first
   * measurement (nothing cached yet), or the previously cached size on a
   * re-measurement.
   */
  record(key: VirtualListKey, index: number, size: number, estimateSize: number): void {
    const roundedSize = Math.round(size);
    const previousSize = this.#sizes.get(key);
    if (previousSize === roundedSize) return;

    const previousBaseline = previousSize ?? estimateSize;
    const delta = roundedSize - previousBaseline;

    this.#sizes.set(key, roundedSize);
    this.#version += 1;

    if (delta !== 0) {
      this.#pendingCorrections.push({ index, delta });
      this.#pendingCorrectionsVersion += 1;
    }
  }

  /**
   * Drains and returns every correction queued since the last call. Call
   * ONLY from `$effect.pre` — a second call with no intervening `record()`
   * returns an empty array.
   */
  consumePendingCorrections(): readonly MeasurementCorrection[] {
    const corrections = this.#pendingCorrections;
    this.#pendingCorrections = [];
    return corrections;
  }

  /**
   * Drops cached sizes for keys no longer present (e.g. after items
   * filters/reorders). Bumps `version` only when a size was actually
   * removed.
   */
  prune(validKeys: ReadonlySet<VirtualListKey>): void {
    const keysToRemove: VirtualListKey[] = [];
    for (const key of this.#sizes.keys()) {
      if (!validKeys.has(key)) keysToRemove.push(key);
    }
    if (keysToRemove.length === 0) return;

    for (const key of keysToRemove) this.#sizes.delete(key);
    this.#version += 1;
  }

  /**
   * Clears every cached size and any undrained pending corrections. Bumps
   * `version` only when there was a cached size to clear.
   */
  reset(): void {
    if (this.#sizes.size > 0) {
      this.#sizes.clear();
      this.#version += 1;
    }
    this.#pendingCorrections = [];
  }
}
