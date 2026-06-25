import './event-stream-viewer.css';
import EventStreamViewer from './event-stream-viewer.svelte';

export default EventStreamViewer;
export type {
  EventSeverity,
  EventStreamEntry,
  EventStreamState,
  EventStreamViewerProps,
  StreamEvent,
  StreamReconnectedBoundary,
} from './event-stream-viewer.types.ts';
export { EventStreamViewer };
