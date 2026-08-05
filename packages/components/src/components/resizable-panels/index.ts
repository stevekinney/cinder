import './resizable-panels.css';
import ResizablePanels from './resizable-panels.svelte';

export default ResizablePanels;
export type {
  ResizablePanelDefinition,
  ResizablePanelRenderContext,
  ResizablePanelSize,
  ResizablePanelSizeState,
  ResizablePanelSizeUnit,
  ResizablePanelsCollapseTarget,
  ResizablePanelsOrientation,
  ResizablePanelsProps,
  ResizablePanelsResizeEvent,
  ResizablePanelsResizeReason,
} from './resizable-panels.types.ts';
export { ResizablePanels };
