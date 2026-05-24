import DropdownItem from '../dropdown-item/dropdown-item.svelte';
import DropdownLabel from '../dropdown-label/dropdown-label.svelte';
import DropdownMenu from '../dropdown-menu/dropdown-menu.svelte';
import DropdownSeparator from '../dropdown-separator/dropdown-separator.svelte';
import DropdownTrigger from '../dropdown-trigger/dropdown-trigger.svelte';
import DropdownRoot from './dropdown.svelte';

/**
 * `Dropdown` is the parent compound component and a namespace exposing the
 * compose-only leaves: `Dropdown.Trigger`, `Dropdown.Menu`, `Dropdown.Item`,
 * `Dropdown.Label`, and `Dropdown.Separator`. The leaves remain importable
 * individually via `cinder/dropdown-trigger`, `cinder/dropdown-menu`, etc.
 */
const Dropdown = Object.assign(DropdownRoot, {
  Trigger: DropdownTrigger,
  Menu: DropdownMenu,
  Item: DropdownItem,
  Label: DropdownLabel,
  Separator: DropdownSeparator,
}) as typeof DropdownRoot & {
  Trigger: typeof DropdownTrigger;
  Menu: typeof DropdownMenu;
  Item: typeof DropdownItem;
  Label: typeof DropdownLabel;
  Separator: typeof DropdownSeparator;
};

export default Dropdown;
export {
  DROPDOWN_CONTEXT,
  DROPDOWN_REGISTER,
  DROPDOWN_REGISTER_TRIGGER,
  DROPDOWN_SET_OPEN,
} from './dropdown.context.ts';
export type { DropdownContext, DropdownPlacement, DropdownProps } from './dropdown.types.ts';
export { Dropdown };
