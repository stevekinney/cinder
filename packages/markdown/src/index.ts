// The rendering namespace is intentionally NOT re-exported from the root.
// Importing the bare `@cinder/markdown` would otherwise drag the entire
// shiki + unified + remark + rehype + katex graph into a consumer's
// bundle even when they only need diff or pipeline utilities. Consumers
// that want the rendering pipeline must import the explicit subpath:
//   import { renderMarkdown } from '@cinder/markdown/rendering';
export * as diff from './diff/index.js';
export * as pipeline from './pipeline/index.js';
