import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

export type ResizablePanelsOrientation = 'horizontal' | 'vertical';
export type ResizablePanelSizeUnit = 'px' | 'percent';
export type ResizablePanelsCollapseTarget = 'leading' | 'trailing' | 'nearest-collapsible';
export type ResizablePanelsResizeReason = 'pointer' | 'keyboard' | 'double-click';

export type ResizablePanelSize = {
  value: number;
  unit: ResizablePanelSizeUnit;
};

export type ResizablePanelDefinition = {
  id: string;
  label: string;
  defaultSize?: ResizablePanelSize;
  minSize?: ResizablePanelSize;
  maxSize?: ResizablePanelSize;
  snapPoints?: ResizablePanelSize[];
  collapsible?: boolean;
  defaultCollapsed?: boolean;
};

export type ResizablePanelRenderContext = {
  id: string;
  index: number;
  collapsed: boolean;
  size: ResizablePanelSize;
  pixelSize: number;
  percentage: number;
};

export type ResizablePanelSizeState = {
  id: string;
  size: ResizablePanelSize;
  pixelSize: number;
  percentage: number;
  collapsed: boolean;
};

export type ResizablePanelsResizeEvent = {
  reason: ResizablePanelsResizeReason;
  orientation: ResizablePanelsOrientation;
  sizes: ResizablePanelSizeState[];
};

export type ResizablePanelsProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  'children' | 'class' | 'onresize'
> & {
  panes: ResizablePanelDefinition[];
  orientation?: ResizablePanelsOrientation;
  keyboardStep?: ResizablePanelSize;
  snapThreshold?: ResizablePanelSize;
  collapseOnDoubleClick?: boolean;
  collapseTarget?: ResizablePanelsCollapseTarget;
  onlayoutchange?: (event: ResizablePanelsResizeEvent) => void;
  onlayoutcommit?: (event: ResizablePanelsResizeEvent) => void;
  children: Snippet<[pane: ResizablePanelDefinition, context: ResizablePanelRenderContext]>;
  class?: string;
};

export interface ResizablePanelsSchemaProps {
  panes: ResizablePanelDefinition[];
  orientation?: ResizablePanelsOrientation;
  keyboardStep?: ResizablePanelSize;
  snapThreshold?: ResizablePanelSize;
  collapseOnDoubleClick?: boolean;
  collapseTarget?: ResizablePanelsCollapseTarget;
  class?: string;
}
