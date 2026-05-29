import FeedEvent from '../feed-event/feed-event.svelte';
import FeedRoot from './feed.svelte';

/**
 * `Feed` is the parent compound component and a namespace exposing the
 * compose-only `Feed.Event` leaf. The leaf remains importable individually via
 * `cinder/feed-event`.
 */
const Feed = Object.assign(FeedRoot, {
  Event: FeedEvent,
});

export default Feed;
export type { FeedProps } from './feed.types.ts';
export { Feed };
