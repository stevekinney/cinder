import './event-stream-viewer.css';
import EventStreamViewer from './event-stream-viewer.svelte';

export default EventStreamViewer;
export type {
  EventSeverity,
  EventStreamState,
  EventStreamViewerProps,
  StreamEvent,
} from './event-stream-viewer.types.ts';
export { EventStreamViewer };
