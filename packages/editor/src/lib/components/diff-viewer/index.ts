import DiffViewer from './diff-viewer.svelte';

export default DiffViewer;
export type {
  DiffToolbarContext,
  DiffViewerAnnotationCoordinateSpace,
  DiffViewerAnnotationRejection,
  DiffViewerAnnotationRejectionReason,
  DiffViewerAnnotationResult,
  DiffViewerAnnotationSelection,
  DiffViewerAnnotationSide,
  DiffViewerFocusResult,
  DiffViewerFrontMatterAnnotationContext,
  DiffViewerLineAnnotationContext,
  DiffViewerMode,
  DiffViewerProps,
  DiffViewerRawMapping,
  DiffViewerRef,
} from './diff-viewer.types.ts';
export { DiffViewer };
