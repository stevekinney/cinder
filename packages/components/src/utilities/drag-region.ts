import type { HostPlatform } from '../_internal/host-context.ts';

export const dragRegionClass = 'cinder-drag-region';
export const noDragClass = 'cinder-no-drag';

export function dragRegionProps(
  platform: HostPlatform = 'web',
): Record<string, string | undefined> {
  return platform === 'web' ? {} : { class: dragRegionClass };
}

export function noDragProps(platform: HostPlatform = 'web'): Record<string, string | undefined> {
  return platform === 'web' ? {} : { class: noDragClass };
}

export const safeHeaderDragStyle =
  'padding-inline-start: var(--spacing-token-safe-header-left, 0px); padding-inline-end: var(--spacing-token-safe-header-right, 0px);';
