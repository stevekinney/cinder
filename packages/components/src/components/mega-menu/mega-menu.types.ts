import type { HTMLAttributes } from 'svelte/elements';

export type MegaMenuLink = {
  id: string;
  label: string;
  href: string;
  description?: string;
};

export type MegaMenuSection = {
  id: string;
  title?: string;
  links: MegaMenuLink[];
};

export type MegaMenuItemWithSections = {
  id: string;
  label: string;
  description?: string;
  sections: MegaMenuSection[];
  submenu?: MegaMenuItem[];
};

export type MegaMenuItemWithSubmenu = {
  id: string;
  label: string;
  description?: string;
  sections?: MegaMenuSection[];
  submenu: MegaMenuItem[];
};

/** A top-level mega-menu item must supply at least one content source: sections or submenu. */
export type MegaMenuItem = MegaMenuItemWithSections | MegaMenuItemWithSubmenu;

export type MegaMenuProps = Omit<HTMLAttributes<HTMLElement>, 'children' | 'class'> & {
  /** Top-level trigger/content entries. */
  items: MegaMenuItem[];
  /** Hover opens top-level content instead of click-only mode. */
  openOnHover?: boolean;
  /** Render the shared content viewport wrapper. */
  showViewport?: boolean;
  /** Render an active trigger indicator bar. */
  showIndicator?: boolean;
  /** Accessible name for the navigation landmark. */
  label?: string;
  /** Additional classes merged onto the root element. */
  class?: string;
};
