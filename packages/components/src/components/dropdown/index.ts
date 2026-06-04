import DropdownGroup from '../dropdown-group/dropdown-group.svelte';
import DropdownItem from '../dropdown-item/dropdown-item.svelte';
import DropdownLabel from '../dropdown-label/dropdown-label.svelte';
import DropdownMenu from '../dropdown-menu/dropdown-menu.svelte';
import DropdownSeparator from '../dropdown-separator/dropdown-separator.svelte';
import DropdownTrigger from '../dropdown-trigger/dropdown-trigger.svelte';
import './dropdown.css';
import DropdownRoot from './dropdown.svelte';

/**
 * `Dropdown` is the parent compound component and a namespace exposing the
 * compose-only leaves: `Dropdown.Trigger`, `Dropdown.Menu`, `Dropdown.Item`,
 * `Dropdown.Label`, `Dropdown.Separator`, and `Dropdown.Group`. The leaves
 * remain importable individually via `@lostgradient/cinder/dropdown-trigger`,
 * `@lostgradient/cinder/dropdown-menu`, etc.
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
// Context getter functions are intentionally excluded from the public barrel:
// setters would allow external code to hijack the dropdown wiring of any subtree,
// and raw getters without the provider are not a supported use case for consumers.
// Internal bridges (menu-bar, context-menu) import from dropdown.context.ts directly.
export type { DropdownContext, DropdownPlacement, DropdownProps } from './dropdown.types.ts';
export { Dropdown };
