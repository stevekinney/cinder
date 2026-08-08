import FeedBoundary from '../feed-boundary/feed-boundary.svelte';
import FeedEvent from '../feed-event/feed-event.svelte';
import './feed.css';
import FeedRoot from './feed.svelte';

/**
 * `Feed` is the parent compound component and a namespace exposing the
 * compose-only `Feed.Event` and `Feed.Boundary` leaves. The leaves remain
 * importable individually via `@lostgradient/cinder/feed-event` and
 * `@lostgradient/cinder/feed-boundary`.
 */
const Feed = Object.assign(FeedRoot, {
  Event: FeedEvent,
  Boundary: FeedBoundary,
});

export default Feed;
export type { FeedConnectionState, FeedListProps, FeedLogProps, FeedProps } from './feed.types.ts';
export { Feed };
