import ToolbarGroup from './toolbar-group.svelte';
import ToolbarSpacer from './toolbar-spacer.svelte';
import ToolbarRoot from './toolbar.svelte';

const Toolbar = Object.assign(ToolbarRoot, {
  Group: ToolbarGroup,
  Spacer: ToolbarSpacer,
}) as typeof ToolbarRoot & {
  Group: typeof ToolbarGroup;
  Spacer: typeof ToolbarSpacer;
};

export default Toolbar;
export type {
  ToolbarGroupProps,
  ToolbarOrientation,
  ToolbarProps,
  ToolbarSpacerProps,
} from './toolbar.types.ts';
export { Toolbar, ToolbarGroup, ToolbarSpacer };
