// Deprecated alias — do not edit by hand.
//
// `cinder/experimental/message` moved to `cinder/message` when the component
// was promoted to stable. This shim re-exports the new location so existing
// imports keep resolving during the deprecation window, and warns once (dev
// only) so consumers migrate before the alias is removed in the next major.
// Generated/managed by scripts/generate-exports.ts.

import { devWarn } from '../../../utilities/dev-warn.ts';

devWarn(
  "[cinder] 'cinder/experimental/message' is deprecated and will be removed in the next major. " +
    "Import from 'cinder/message' instead.",
);

export { default, Message } from '../../message/index.ts';
export type { MessageProps, MessageRole } from '../../message/index.ts';
