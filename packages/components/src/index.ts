export { default as AccordionItem } from './components/accordion-item.svelte';
export type { AccordionItemProps } from './components/accordion-item.svelte';

export { default as Accordion } from './components/accordion.svelte';
export type { AccordionContext, AccordionProps } from './components/accordion.svelte';

export { default as Alert } from './components/alert.svelte';
export type { AlertProps, AlertVariant } from './components/alert.svelte';

export { default as Avatar } from './components/avatar.svelte';
export type { AvatarProps, AvatarShape, AvatarSize } from './components/avatar.svelte';

export { default as Badge } from './components/badge.svelte';
export type { BadgeProps, BadgeSize, BadgeVariant } from './components/badge.svelte';

export { default as Banner } from './components/banner.svelte';
export type { BannerProps, BannerVariant } from './components/banner.svelte';

export { default as Breadcrumbs } from './components/breadcrumbs.svelte';
export type { BreadcrumbItem, BreadcrumbsProps } from './components/breadcrumbs.svelte';

export { default as Button } from './components/button.svelte';
export type { ButtonProps, ButtonSize, ButtonVariant } from './components/button.svelte';

export { default as ButtonGroup } from './components/button-group.svelte';
export type { ButtonGroupOrientation, ButtonGroupProps } from './components/button-group.svelte';

export { default as Card } from './components/card.svelte';
export type { CardProps } from './components/card.svelte';

export { default as Chat } from './components/chat.svelte';
export type { ChatProps } from './components/chat.svelte';

export { default as Chip } from './components/chip.svelte';
export type {
  ChipDisplayProps,
  ChipMode,
  ChipProps,
  ChipRemovableProps,
  ChipSize,
  ChipToggleProps,
  ChipVariant,
} from './components/chip.svelte';

export { default as Checkbox } from './components/checkbox.svelte';
export type { CheckboxProps } from './components/checkbox.svelte';

export { default as CheckboxGroup } from './components/checkbox-group.svelte';
export type { CheckboxGroupProps } from './components/checkbox-group.svelte';

export { default as CodeBlock } from './components/code-block.svelte';
export type { CodeBlockProps } from './components/code-block.svelte';

export { default as ColorSwatchPicker } from './components/color-swatch-picker.svelte';
export type { ColorSwatch, ColorSwatchPickerProps } from './components/color-swatch-picker.svelte';

export { default as Combobox } from './components/combobox.svelte';
export type { ComboboxOption, ComboboxProps } from './components/combobox.svelte';

export { default as CommandItem } from './components/command-item.svelte';
export type { CommandItemProps } from './components/command-item.svelte';

export { default as CommandPalette } from './components/command-palette.svelte';
export type { CommandPaletteProps } from './components/command-palette.svelte';

export { default as ConfirmDialog } from './components/confirm-dialog.svelte';
export type { ConfirmDialogProps } from './components/confirm-dialog.svelte';

export { default as CopyButton } from './components/copy-button.svelte';
export type { CopyButtonProps } from './components/copy-button.svelte';

export { copyToClipboard } from './utilities/clipboard.ts';

export { default as DataList } from './components/data-list.svelte';
export type { DataListProps } from './components/data-list.svelte';

export { default as DatePicker } from './components/date-picker.svelte';
export type {
  DatePickerMode,
  DatePickerProps,
  DatePickerRangeValue,
  DatePickerSingleValue,
  DatePickerValue,
} from './components/date-picker.svelte';

export { default as DescriptionList } from './components/description-list.svelte';
export type {
  DescriptionListItem,
  DescriptionListProps,
  DescriptionListVariant,
} from './components/description-list.svelte';

export { default as DiffStatistics } from './components/diff-statistics.svelte';
export type {
  DiffStatisticsProps,
  DiffStatisticsVariant,
} from './components/diff-statistics.svelte';

export { default as DiffViewer } from './components/diff-viewer.svelte';
export type {
  DiffToolbarContext,
  DiffViewerProps,
  ViewMode,
} from './components/diff-viewer.svelte';

export { default as Drawer } from './components/drawer.svelte';
export type { DrawerProps, DrawerSide, DrawerSize } from './components/drawer.svelte';

export { default as Dropdown } from './components/dropdown.svelte';
export type {
  DropdownContext,
  DropdownPlacement,
  DropdownProps,
} from './components/dropdown.svelte';

export { default as DropdownItem } from './components/dropdown-item.svelte';
export type { DropdownItemProps, DropdownItemVariant } from './components/dropdown-item.svelte';

export { default as DropdownLabel } from './components/dropdown-label.svelte';
export type { DropdownLabelProps } from './components/dropdown-label.svelte';

export { default as DropdownMenu } from './components/dropdown-menu.svelte';
export type { DropdownMenuProps } from './components/dropdown-menu.svelte';

export { default as DropdownSeparator } from './components/dropdown-separator.svelte';
export type { DropdownSeparatorProps } from './components/dropdown-separator.svelte';

export { default as DropdownTrigger } from './components/dropdown-trigger.svelte';
export type { DropdownTriggerProps } from './components/dropdown-trigger.svelte';

export { default as EmptyState } from './components/empty-state.svelte';
export type { EmptyStateProps } from './components/empty-state.svelte';

export { default as FeedEvent } from './components/feed-event.svelte';
export type { FeedEventProps, FeedEventVariant } from './components/feed-event.svelte';

export { default as Feed } from './components/feed.svelte';
export type { FeedProps } from './components/feed.svelte';

export { default as FormField } from './components/form-field.svelte';
export type { FormFieldProps } from './components/form-field.svelte';

export { default as FormSection } from './components/form-section.svelte';
export type { FormSectionHeadingLevel, FormSectionProps } from './components/form-section.svelte';

export type { FormFieldContext } from './_internal/form-field-context.ts';

export { default as GridList } from './components/grid-list.svelte';
export type { GridListProps } from './components/grid-list.svelte';

export { default as GridListItem } from './components/grid-list-item.svelte';
export type { GridListItemProps } from './components/grid-list-item.svelte';

export { default as Input } from './components/input.svelte';
export type { InputProps, InputType } from './components/input.svelte';

export { default as JsonSchemaEditor } from './components/json-schema-editor.svelte';
export type {
  JsonSchemaDraft,
  JsonSchemaEditorChangeEvent,
  JsonSchemaEditorMode,
  JsonSchemaEditorProps,
  JsonSchemaEditorRevertEvent,
  JsonSchemaEditorView,
  JsonSchemaKnownDraft,
  JsonSchemaTypeName,
  JsonSchemaValidationError,
  JsonSchemaValidationResult,
  JsonSchemaValidationStatus,
  JsonSchemaValue,
} from './components/json-schema-editor.svelte';

export { default as Kbd } from './components/kbd.svelte';
export type { KbdProps } from './components/kbd.svelte';

export { default as Label } from './components/label.svelte';
export type { LabelProps } from './components/label.svelte';

export { default as MarkdownEditor } from './components/markdown-editor.svelte';
export type {
  EditorHandle,
  EditorMode,
  MarkdownEditorProps,
  ToolbarContext,
} from './components/markdown-editor.svelte';

export { default as Modal } from './components/modal.svelte';
export type { ModalProps } from './components/modal.svelte';

export { default as NavigationBar } from './components/navigation-bar.svelte';
export type {
  NavigationBarItemsContext,
  NavigationBarProps,
  NavigationBarToggleAttributes,
  NavigationVariant,
} from './components/navigation-bar.svelte';

export { default as NavigationItem } from './components/navigation-item.svelte';
export type { NavigationItemProps } from './components/navigation-item.svelte';

export { default as NumberInput } from './components/number-input.svelte';
export type { NumberInputProps } from './components/number-input.svelte';

export { default as PageLayout } from './components/page-layout.svelte';
export type { PageLayoutProps, PageLayoutTitle } from './components/page-layout.svelte';

export { default as Pagination } from './components/pagination.svelte';
export type { PaginationProps } from './components/pagination.svelte';

export { default as Popover } from './components/popover.svelte';
export type { PopoverPlacement, PopoverProps, PopoverRole } from './components/popover.svelte';

export { default as Progress } from './components/progress.svelte';
export type { ProgressProps, ProgressSize, ProgressVariant } from './components/progress.svelte';

export { default as Radio } from './components/radio.svelte';
export type { RadioProps } from './components/radio.svelte';

export { default as RadioGroup } from './components/radio-group.svelte';
export type { RadioGroupContext, RadioGroupProps } from './components/radio-group.svelte';

export { default as ReviewEditor } from './components/review-editor.svelte';
export type { ReviewEditorProps } from './components/review-editor.svelte';
export {
  buildFormData,
  buildFormDataFromValues,
  createAnchorManager,
  createReviewEditorState,
  createSelectionPopover,
  createThreadManager,
  exportCommentsMarkdown,
  exportMarkdownSummary,
  exportUnifiedDiff,
  getSummaryContentWithoutHeading,
  toPersistedThreads,
  type AnchorManager,
  type AnchorManagerOptions,
  type DiffStats,
  type ExportedReviewFormData,
  type PopoverPosition,
  type ReviewEditorState,
  type ReviewEditorStateOptions,
  type SelectionPopover as ReviewSelectionPopover,
  type SelectionPopoverOptions,
  type ThreadManager,
  type ThreadManagerOptions,
} from './components/review-editor/index.ts';

export { default as SectionHeading } from './components/section-heading.svelte';
export type { SectionHeadingLevel, SectionHeadingProps } from './components/section-heading.svelte';

export { default as SegmentedControl } from './components/segmented-control.svelte';
export type {
  SegmentedControlOption,
  SegmentedControlProps,
} from './components/segmented-control.svelte';

export { default as Select } from './components/select.svelte';
export type { SelectOption, SelectProps } from './components/select.svelte';

export { default as SelectionPopover } from './components/selection-popover.svelte';
export type {
  SelectionPopoverPosition,
  SelectionPopoverProps,
} from './components/selection-popover.svelte';

export { default as SideNavigation } from './components/side-navigation.svelte';
export type { SideNavigationProps } from './components/side-navigation.svelte';

export { default as SideNavigationGroup } from './components/side-navigation-group.svelte';
export type { SideNavigationGroupProps } from './components/side-navigation-group.svelte';

export { default as SideNavigationItem } from './components/side-navigation-item.svelte';
export type { SideNavigationItemProps } from './components/side-navigation-item.svelte';

export { default as SortableList } from './components/sortable-list.svelte';
export type { SortableListProps } from './components/sortable-list.svelte';
export type {
  SortableAnnouncements,
  SortableItemContext,
  SortableReorderChange,
} from './utilities/sortable-controller.svelte.ts';

export { default as Skeleton } from './components/skeleton.svelte';
export type { SkeletonProps } from './components/skeleton.svelte';

export { default as StackedListItem } from './components/stacked-list-item.svelte';
export type {
  StackedListItemDensity,
  StackedListItemProps,
} from './components/stacked-list-item.svelte';

export { default as Spinner } from './components/spinner.svelte';
export type { SpinnerProps, SpinnerSize } from './components/spinner.svelte';

export { default as Steps } from './components/steps.svelte';
export type { StepItem, StepsOrientation, StepsProps } from './components/steps.svelte';

export { default as Stat } from './components/stat.svelte';
export type { StatChange, StatChangeDirection, StatProps } from './components/stat.svelte';

export { default as StatGroup } from './components/stat-group.svelte';
export type {
  StatGroupColumns,
  StatGroupProps,
  StatGroupVariant,
} from './components/stat-group.svelte';

export { default as Surface } from './components/surface.svelte';
export type { SurfaceProps, SurfaceTone } from './components/surface.svelte';

export { default as Tab } from './components/tab.svelte';
export type { TabProps } from './components/tab.svelte';

export { default as TabList } from './components/tab-list.svelte';
export type { TabListProps } from './components/tab-list.svelte';

export { default as TabPanel } from './components/tab-panel.svelte';
export type { TabPanelProps } from './components/tab-panel.svelte';

export { default as Table } from './components/table.svelte';
export type {
  SortDirection,
  TableContext,
  TableDensity,
  TableHeaderSelectionContext,
  TableProps,
  TableSectionContext,
  TableSort,
} from './components/table.svelte';

export { default as TableBody } from './components/table-body.svelte';
export type { TableBodyProps } from './components/table-body.svelte';

export { default as TableCell } from './components/table-cell.svelte';
export type { TableCellProps } from './components/table-cell.svelte';

export { default as TableHeader } from './components/table-header.svelte';
export type { TableHeaderProps } from './components/table-header.svelte';

export { default as TableHeaderCell } from './components/table-header-cell.svelte';
export type { TableHeaderCellProps } from './components/table-header-cell.svelte';

export { default as TableRow } from './components/table-row.svelte';
export type { TableRowProps, TableRowSelectionProps } from './components/table-row.svelte';

export { default as Tabs } from './components/tabs.svelte';
export type { TabsContext, TabsOrientation, TabsProps } from './components/tabs.svelte';

export { default as Textarea } from './components/textarea.svelte';
export type { TextareaProps } from './components/textarea.svelte';

export { default as ToastRegion } from './components/toast-region.svelte';
export type {
  ToastApi,
  ToastItem,
  ToastOptions,
  ToastVariant,
} from './components/toast-region.svelte';

export { useHistory } from './utilities/use-history.svelte.ts';
export type {
  UseHistory,
  UseHistoryCommitOptions,
  UseHistoryEntry,
  UseHistoryEntryMetadata,
  UseHistoryOptions,
} from './utilities/use-history.svelte.ts';

export { useReducedMotion } from './utilities/use-reduced-motion.svelte.ts';
export type { UseReducedMotion } from './utilities/use-reduced-motion.svelte.ts';

export { useToast } from './utilities/use-toast.ts';

export { default as Toggle } from './components/toggle.svelte';
export type { ToggleProps } from './components/toggle.svelte';

export { default as Tree } from './components/tree.svelte';
export type { TreeProps, TreeSelectionMode } from './components/tree.svelte';

export { default as TreeItem } from './components/tree-item.svelte';
export type { TreeItemProps } from './components/tree-item.svelte';

export { default as Tooltip } from './components/tooltip.svelte';
export type { TooltipPlacement, TooltipProps } from './components/tooltip.svelte';

export { default as VisuallyHidden } from './components/visually-hidden.svelte';
export type { VisuallyHiddenProps } from './components/visually-hidden.svelte';

// ---------------------------------------------------------------------------
// Experimental components — exported under cinder/experimental/<name>. Their
// APIs may change between minor versions until they meet the canonical
// promotion criteria documented in the "Library boundary" section of README.md.
// ---------------------------------------------------------------------------

export { default as ConnectionIndicator } from './components/experimental/connection-indicator.svelte';
export type {
  ConnectionIndicatorProps,
  ConnectionState,
} from './components/experimental/connection-indicator.svelte';

export { default as JsonViewer } from './components/experimental/json-viewer.svelte';
export type { JsonViewerProps } from './components/experimental/json-viewer.svelte';

export { default as Message } from './components/experimental/message.svelte';
export type { MessageProps, MessageRole } from './components/experimental/message.svelte';

export { default as Sheet } from './components/experimental/sheet.svelte';
export type { SheetEdge, SheetProps, SheetSize } from './components/experimental/sheet.svelte';

export { default as Timeline } from './components/experimental/timeline.svelte';
export type { TimelineProps } from './components/experimental/timeline.svelte';

export { default as TimelineItem } from './components/experimental/timeline-item.svelte';
export type { TimelineItemProps } from './components/experimental/timeline-item.svelte';
