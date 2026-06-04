// Deprecated alias — do not edit by hand.
//
// `@lostgradient/cinder/experimental/connection-indicator` moved to `@lostgradient/cinder/connection-indicator`
// when the component was promoted to stable. This shim re-exports the new
// location so existing imports keep resolving during the deprecation window,
// and warns once (dev only) so consumers migrate before the alias is removed
// in the next major. Generated/managed by scripts/generate-exports.ts.

import { devWarn } from '../../../utilities/dev-warn.ts';

devWarn(
  "[cinder] '@lostgradient/cinder/experimental/connection-indicator' is deprecated and will be removed in the next major. " +
    "Import from '@lostgradient/cinder/connection-indicator' instead.",
);

export { ConnectionIndicator, default } from '../../connection-indicator/index.ts';
export type {
  ConnectionIndicatorProps,
  ConnectionState,
} from '../../connection-indicator/index.ts';
