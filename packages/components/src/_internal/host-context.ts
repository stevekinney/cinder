import { createContext } from 'svelte';

import type { HostPlatform } from '../components/host-provider/host-provider.types.ts';
import { optionalContext } from './optional-context.ts';

export type { HostPlatform } from '../components/host-provider/host-provider.types.ts';
export type HostContext = { platform: HostPlatform; isDesktop: boolean };

const [getHostContextStrict, setHostContextRaw] = createContext<HostContext>();
export function setHostContext(value: HostContext): void {
  setHostContextRaw(value);
}

export function getHostContext(): HostContext {
  return optionalContext(getHostContextStrict)() ?? { platform: 'web', isDesktop: false };
}
