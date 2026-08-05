import './source-diff-viewer.css';
import SourceDiffViewer from './source-diff-viewer.svelte';

export default SourceDiffViewer;
export { getSourceDiffFileLabel, getSourceDiffLineLabel } from './source-diff-viewer.labels.ts';
export type {
  SourceDiffFile,
  SourceDiffHunk,
  SourceDiffLine,
  SourceDiffLineKind,
  SourceDiffParseResult,
  SourceDiffViewerProps,
} from './source-diff-viewer.types.ts';
export { parseUnifiedPatch } from './source-diff-viewer.utilities.ts';
export { SourceDiffViewer };
