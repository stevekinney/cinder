export { useAnnouncer } from '../utilities/use-announcer.svelte.ts';
export type { Announcer, AnnouncerOptions } from '../utilities/use-announcer.types.ts';

export { useHistory } from '../utilities/use-history.svelte.ts';
export type {
  UseHistory,
  UseHistoryCommitOptions,
  UseHistoryEntry,
  UseHistoryEntryMetadata,
  UseHistoryOptions,
  UseHistorySnapshot,
} from '../utilities/use-history.types.ts';

export { useIntersection } from '../utilities/use-intersection.svelte.ts';
export { useMutationObserver } from '../utilities/use-mutation-observer.svelte.ts';
export {
  applyReducedMotionPreference,
  resolveReducedMotion,
  useReducedMotion,
} from '../utilities/use-reduced-motion.svelte.ts';
export type {
  ReducedMotionPreference,
  UseReducedMotion,
} from '../utilities/use-reduced-motion.types.ts';
export { useResizeObserver } from '../utilities/use-resize-observer.svelte.ts';

export { useToast } from '../utilities/use-toast.ts';

export {
  dragRegionClass,
  dragRegionProps,
  noDragClass,
  noDragProps,
  safeHeaderDragStyle,
} from '../utilities/drag-region.ts';
export { createFormDirtyGuard } from '../utilities/form-dirty-guard.ts';
export type { FormDirtyGuard } from '../utilities/form-dirty-guard.ts';

export { enhanceJson } from '../components/json-editor/json-editor-enhancement.ts';
export type { Highlighter } from '../utilities/highlighter.ts';
