/**
 * Realtime source abstraction (plan §5, T1.4). Frozen after the Phase 1
 * Foundation gate — see PROJECT-BRIEF "Shared contracts".
 *
 * `LiveSource<Frame>` below is copied **verbatim** from plan §5 — every live
 * surface in the console (workflow tail, fleet feed, polling fallback)
 * consumes exactly this shape so `ConnectionIndicator` (Cinder) can bind to
 * `status` uniformly regardless of which implementation backs a given
 * surface.
 *
 * `LiveSourceStatus` extends plan §5's literal 5-state block to 6 states,
 * adding `'stale'`. Verified against Cinder v0.16.1's actual
 * `ConnectionIndicator` (`cinder/components/cinder/src/components/
 * connection-indicator/connection-indicator.types.ts`), which ships exactly
 * `'connecting' | 'live' | 'reconnecting' | 'polling' | 'stale' | 'closed'`
 * — `stale` is real, shipped vocabulary (a distinct icon/color/`data-cinder-
 * status`), not a plan typo to route around. T1.4's task brief calls for
 * aligning with that vocabulary explicitly, so this is a deliberate,
 * task-directed widening of the frozen skeleton's status union, not scope
 * creep — every downstream track (A–E) binding `LiveSource.status` to
 * `ConnectionIndicator` should treat 6 states as the real contract.
 */

/** Connection status a `LiveSource` reports; rune-backed so `ConnectionIndicator` binds directly. */
export type LiveSourceStatus =
  'connecting' | 'live' | 'reconnecting' | 'polling' | 'stale' | 'closed';

/** Uniform interface every live surface consumes (plan §5, verbatim). */
export interface LiveSource<Frame> {
  subscribe(onFrame: (f: Frame) => void): () => void;
  whenConnected(): Promise<void>;
  status: LiveSourceStatus;
  close(): void;
}
