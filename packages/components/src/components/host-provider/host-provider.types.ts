import type { Snippet } from 'svelte';

export type HostPlatform = 'web' | 'macos' | 'windows' | 'linux';

export type HostProviderProps = {
  /** Host platform. Defaults to `web`, where desktop chrome behavior is inert. */
  platform?: HostPlatform;
  /** Inline-start titlebar inset supplied by the desktop host. Defaults to `0px`. */
  safeHeaderLeft?: string;
  /** Inline-end titlebar inset supplied by the desktop host. Defaults to `0px`. */
  safeHeaderRight?: string;
  /** Descendant application surface. */
  children?: Snippet;
};
