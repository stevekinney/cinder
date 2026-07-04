import './source-diff-viewer.css';
import SourceDiffViewer from './source-diff-viewer.svelte';

export default SourceDiffViewer;
export type {
  SourceDiffFile,
  SourceDiffHunk,
  SourceDiffLine,
  SourceDiffLineKind,
  SourceDiffParseResult,
  SourceDiffViewerProps,
} from './source-diff-viewer.types.ts';
export {
  getSourceDiffFileLabel,
  getSourceDiffLineLabel,
  parseUnifiedPatch,
} from './source-diff-viewer.utilities.ts';
export { SourceDiffViewer };
