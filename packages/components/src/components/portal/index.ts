import Portal from './portal.svelte';

export default Portal;
export type { PortalAttachmentOptions, PortalProps } from './portal.types.ts';
export { createPortalAttachment, invalidatePortalDirection } from './portal.utilities.svelte.ts';
export { Portal };
