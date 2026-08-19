export type ReducedMotionPreference = 'off' | 'on' | 'system';

export type UseReducedMotion = {
  /** Reactive boolean — `true` when the user prefers reduced motion. */
  readonly current: boolean;
};
