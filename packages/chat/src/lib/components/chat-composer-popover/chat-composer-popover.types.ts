import type { PopoverPlacement } from '@lostgradient/cinder/popover';
import type { Snippet } from 'svelte';

export type ChatComposerPopoverItem = {
  /** Stable submitted value surfaced through onselect. */
  value: string;
  /** Default visible and accessible label for the command row. */
  label: string;
  /** Optional secondary text for the command row. */
  description?: string | undefined;
  /** Optional fuzzy-search aliases. */
  keywords?: readonly string[] | undefined;
  /** Whether this row is skipped by keyboard navigation and activation. */
  disabled?: boolean | undefined;
};

export type ChatComposerPopoverTriggerMatch = {
  active: true;
  trigger: string;
  query: string;
  start: number;
  end: number;
};

export type ChatComposerPopoverSelection<TItem extends ChatComposerPopoverItem> = {
  item: TItem;
  value: string;
  query: string;
  trigger: string;
  range: {
    start: number;
    end: number;
  };
};

export type ChatComposerPopoverComposerProps = {
  composerRole: 'combobox';
  composerAriaExpanded: boolean;
  composerAriaControls: string | undefined;
  composerAriaActiveDescendant: string | undefined;
  composerAriaAutocomplete: 'list';
  oncomposerinput: (value: string, event?: Event) => void;
  oncomposerkeydown: (event: KeyboardEvent) => void;
  oncomposerselectionchange: (event: Event) => void;
  oncomposerblur: (event: FocusEvent) => void;
};

export type ChatComposerPopoverItemSnippetContext<TItem extends ChatComposerPopoverItem> = {
  item: TItem;
  query: string;
  trigger: string;
};

export type ChatComposerPopoverProps<TItem extends ChatComposerPopoverItem> = {
  /** Unique identifier used for the listbox and item ids. */
  id: string;
  /** Current composer value. Bind this to ChatInput, or pass Chat's oncomposerinput callback. */
  value?: string;
  /** Consumer-owned command or mention definitions. */
  items: readonly TItem[];
  /** Trigger characters that open the popover. Default `['/', '@']`. */
  triggers?: readonly string[];
  /** Accessible listbox label. Default `'Composer suggestions'`. */
  label?: string;
  /** Caret-relative placement. Default `'bottom-start'`. */
  placement?: PopoverPlacement;
  /** Distance in px between the caret and popover. Default `6`. */
  offset?: number;
  /** Render the ChatInput or compatible composer with the provided overlay props. */
  composer: Snippet<[ChatComposerPopoverComposerProps]>;
  /** Optional custom row contents. Defaults to the item label and description. */
  item?: Snippet<[ChatComposerPopoverItemSnippetContext<TItem>]>;
  /** Optional empty state rendered when filtering produces no matching rows. */
  empty?: Snippet;
  /** Override trigger detection. */
  detectTrigger?: (
    value: string,
    selectionStart: number,
    selectionEnd: number,
  ) => ChatComposerPopoverTriggerMatch | null;
  /** Override filtering. */
  filter?: (items: readonly TItem[], query: string, trigger: string) => readonly TItem[];
  /** Invoked when an enabled item is selected by keyboard or pointer. */
  onselect?: (selection: ChatComposerPopoverSelection<TItem>) => void;
  /** Invoked when Escape, trigger loss, or outside pointerdown dismisses the popover. */
  ondismiss?: () => void;
};
