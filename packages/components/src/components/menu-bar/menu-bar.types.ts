import type { HTMLAttributes } from 'svelte/elements';

export type MenuBarItemVariant = 'default' | 'danger';

export type MenuBarItem = {
  type?: 'item';
  id: string;
  label: string;
  disabled?: boolean;
  variant?: MenuBarItemVariant;
  closeOnSelect?: boolean;
  shortcut?: string;
  onSelect?: (event: MouseEvent) => void;
};

export type MenuBarLabel = {
  type: 'label';
  id: string;
  label: string;
};

export type MenuBarSeparator = {
  type: 'separator';
  id: string;
};

export type MenuBarSubmenuEntry = MenuBarItem | MenuBarLabel | MenuBarSeparator;

export type MenuBarSubmenu = {
  type: 'submenu';
  id: string;
  label: string;
  disabled?: boolean;
  items: readonly MenuBarSubmenuEntry[];
};

export type MenuBarEntry = MenuBarItem | MenuBarSubmenu | MenuBarLabel | MenuBarSeparator;

export type MenuBarMenu = {
  id: string;
  label: string;
  accessKey?: string;
  disabled?: boolean;
  items: readonly MenuBarEntry[];
};

type OwnedMenuBarRootAttributes =
  | 'class'
  | 'id'
  | 'role'
  | 'aria-label'
  | 'aria-labelledby'
  | 'aria-orientation';

export type MenuBarProps = Omit<HTMLAttributes<HTMLDivElement>, OwnedMenuBarRootAttributes> & {
  id?: string;
  menus: readonly MenuBarMenu[];
  label?: string;
  labelledBy?: string;
  class?: string;
};

export interface MenuBarSchemaProps {
  /** HTML id applied to the menubar root element. Auto-generated when omitted. */
  id?: string;
  menus: readonly MenuBarMenu[];
  /** Accessible label for the menubar, applied as aria-label. Ignored when labelledBy is set. Default `Application menu`. */
  label?: string;
  /** ID of an existing element whose text labels the menubar, applied as aria-labelledby. Takes precedence over label. */
  labelledBy?: string;
  /** Additional class names merged with the component's root class. */
  class?: string;
}
