import ContextMenuTrigger from '../context-menu-trigger/context-menu-trigger.svelte';
import DropdownGroup from '../dropdown-group/dropdown-group.svelte';
import DropdownItem from '../dropdown-item/dropdown-item.svelte';
import DropdownLabel from '../dropdown-label/dropdown-label.svelte';
import DropdownMenu from '../dropdown-menu/dropdown-menu.svelte';
import DropdownSeparator from '../dropdown-separator/dropdown-separator.svelte';
import './context-menu.css';
import ContextMenuRoot from './context-menu.svelte';

const ContextMenu = Object.assign(ContextMenuRoot, {
  Trigger: ContextMenuTrigger,
  Menu: DropdownMenu,
  Item: DropdownItem,
  Label: DropdownLabel,
  Separator: DropdownSeparator,
  Group: DropdownGroup,
});

export default ContextMenu;
export type { ContextMenuProps } from './context-menu.types.ts';
export { ContextMenu };
