/**
 * A `$state`-backed clock that ticks once a second, for the header's deadline
 * countdown and the Updates tab's "Ns elapsed" pending indicator (plan T2.4,
 * T2.6). Local to this track — not a shared foundation module — since
 * nothing outside `workflows/detail/**` needs it today.
 */
export class TickingClock {
  now = $state(Date.now());

  #timer: ReturnType<typeof setInterval> | null = null;

  constructor(intervalMs = 1000) {
    this.#timer = setInterval(() => {
      this.now = Date.now();
    }, intervalMs);
  }

  dispose(): void {
    if (this.#timer !== null) {
      clearInterval(this.#timer);
      this.#timer = null;
    }
  }
}
