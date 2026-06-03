// Deprecated alias — do not edit by hand.
//
// `cinder/experimental/timeline` moved to `cinder/timeline` when the component
// was promoted to stable. This shim re-exports the new location so existing
// imports keep resolving during the deprecation window, and warns once (dev
// only) so consumers migrate before the alias is removed in the next major.
// Generated/managed by scripts/generate-exports.ts.

import { devWarn } from '../../../utilities/dev-warn.ts';

devWarn(
  "[cinder] 'cinder/experimental/timeline' is deprecated and will be removed in the next major. " +
    "Import from 'cinder/timeline' instead.",
);

export { default, Timeline } from '../../timeline/index.ts';
export type {
  TimelineEntry,
  TimelineGroupBy,
  TimelineHeadingLevel,
  TimelineOrientation,
  TimelineProps,
  TimelineTone,
  TimelineWeekStartsOn,
} from '../../timeline/index.ts';
