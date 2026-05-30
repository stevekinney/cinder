// Deprecated alias — do not edit by hand.
//
// `cinder/experimental/json-viewer` moved to `cinder/json-viewer` when the
// component was promoted to stable. This shim re-exports the new location so
// existing imports keep resolving during the deprecation window, and warns
// once (dev only) so consumers migrate before the alias is removed in the
// next major. Generated/managed by scripts/generate-exports.ts.

import { DEV } from 'esm-env';

if (DEV) {
  console.warn(
    "[cinder] 'cinder/experimental/json-viewer' is deprecated and will be removed in the next major. " +
      "Import from 'cinder/json-viewer' instead.",
  );
}

export { default, JsonViewer } from '../../json-viewer/index.ts';
export type { JsonViewerProps } from '../../json-viewer/index.ts';
