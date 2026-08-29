import { getContext, setContext } from 'svelte';

import type { HostPlatform } from '../components/host-provider/host-provider.types.ts';

export type { HostPlatform } from '../components/host-provider/host-provider.types.ts';
export type HostContext = { platform: HostPlatform; isDesktop: boolean };

const HOST_CONTEXT = Symbol('cinder-host');
export function setHostContext(value: HostContext): void {
  setContext(HOST_CONTEXT, value);
}

export function getHostContext(): HostContext {
  return getContext<HostContext>(HOST_CONTEXT) ?? { platform: 'web', isDesktop: false };
}
