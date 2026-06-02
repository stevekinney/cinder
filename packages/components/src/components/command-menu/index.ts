import './command-menu.css';
import CommandMenu from './command-menu.svelte';

export default CommandMenu;
export { detectTrigger } from './command-menu-trigger.ts';
export type {
  CommandMenuProps,
  CommandMenuSelection,
  CommandMenuState,
  CommandMenuTriggerMatch,
} from './command-menu.types.ts';
export { CommandMenu };
