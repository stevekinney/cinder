import DropdownGroup from '../dropdown-group/dropdown-group.svelte';
import DropdownItem from '../dropdown-item/dropdown-item.svelte';
import DropdownLabel from '../dropdown-label/dropdown-label.svelte';
import DropdownMenu from '../dropdown-menu/dropdown-menu.svelte';
import DropdownSeparator from '../dropdown-separator/dropdown-separator.svelte';
import DropdownTrigger from '../dropdown-trigger/dropdown-trigger.svelte';
import DropdownRoot from './dropdown.svelte';

/**
 * `Dropdown` is the parent compound component and a namespace exposing the
 * compose-only leaves: `Dropdown.Trigger`, `Dropdown.Menu`, `Dropdown.Item`,
 * `Dropdown.Label`, `Dropdown.Separator`, and `Dropdown.Group`. The leaves
 * remain importable individually via `cinder/dropdown-trigger`,
 * `cinder/dropdown-menu`, etc.
 */
const Dropdown = Object.assign(DropdownRoot, {
  Trigger: DropdownTrigger,
  Menu: DropdownMenu,
  Item: DropdownItem,
  Label: DropdownLabel,
  Separator: DropdownSeparator,
  Group: DropdownGroup,
});

export default Dropdown;
export {
  DROPDOWN_CONTEXT,
  DROPDOWN_REGISTER,
  DROPDOWN_REGISTER_TRIGGER,
  DROPDOWN_SET_OPEN,
} from './dropdown.context.ts';
export type { DropdownContext, DropdownPlacement, DropdownProps } from './dropdown.types.ts';
export { Dropdown };
