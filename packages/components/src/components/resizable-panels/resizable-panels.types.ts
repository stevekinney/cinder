import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

export type ResizablePanelsOrientation = 'horizontal' | 'vertical';
export type ResizablePanelSizeUnit = 'px' | 'percent';
export type ResizablePanelsCollapseTarget = 'leading' | 'trailing' | 'nearest-collapsible';
export type ResizablePanelsResizeReason = 'pointer' | 'keyboard' | 'double-click' | 'rebase';

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
  /** Direction the panes are arranged. `'horizontal'` (default) places them side by side; `'vertical'` stacks them. */
  orientation?: ResizablePanelsOrientation;
  keyboardStep?: ResizablePanelSize;
  snapThreshold?: ResizablePanelSize;
  /** When true, double-clicking a separator collapses or expands the adjacent collapsible pane. Default `false`. */
  collapseOnDoubleClick?: boolean;
  /** Which pane to collapse when double-clicking a separator: `'leading'`, `'trailing'`, or `'nearest-collapsible'` (default). */
  collapseTarget?: ResizablePanelsCollapseTarget;
  onlayoutchange?: (event: ResizablePanelsResizeEvent) => void;
  onlayoutcommit?: (event: ResizablePanelsResizeEvent) => void;
  children: Snippet<[pane: ResizablePanelDefinition, context: ResizablePanelRenderContext]>;
  /** Additional class merged onto the `.cinder-resizable-panels` root element. */
  class?: string;
}
