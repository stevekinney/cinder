// Deprecated alias — do not edit by hand.
//
// `@lostgradient/cinder/experimental/timeline-item` moved to `@lostgradient/cinder/timeline-item` when the
// component was promoted to stable. This shim re-exports the new location so
// existing imports keep resolving during the deprecation window, and warns
// once (dev only) so consumers migrate before the alias is removed in the
// next major. Generated/managed by scripts/generate-exports.ts.

import { devWarn } from '../../../utilities/dev-warn.ts';

devWarn(
  "[cinder] '@lostgradient/cinder/experimental/timeline-item' is deprecated and will be removed in the next major. " +
    "Import from '@lostgradient/cinder/timeline-item' instead.",
);

export { default, TimelineItem } from '../../timeline-item/index.ts';
export type { TimelineItemProps } from '../../timeline-item/index.ts';
