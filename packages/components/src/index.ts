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

export { default as Breadcrumbs } from './components/breadcrumbs.svelte';
export type { BreadcrumbItem, BreadcrumbsProps } from './components/breadcrumbs.svelte';

export { default as Button } from './components/button.svelte';
export type { ButtonProps, ButtonSize, ButtonVariant } from './components/button.svelte';

export { default as Card } from './components/card.svelte';
export type { CardProps } from './components/card.svelte';

export { default as Checkbox } from './components/checkbox.svelte';
export type { CheckboxProps } from './components/checkbox.svelte';

export { default as CodeBlock } from './components/code-block.svelte';
export type { CodeBlockProps } from './components/code-block.svelte';

export { default as Combobox } from './components/combobox.svelte';
export type { ComboboxOption, ComboboxProps } from './components/combobox.svelte';

export { default as CopyButton } from './components/copy-button.svelte';
export type { CopyButtonProps } from './components/copy-button.svelte';

export { copyToClipboard } from './utilities/clipboard.ts';

export { default as DataList } from './components/data-list.svelte';
export type { DataListProps } from './components/data-list.svelte';

export { default as Dropdown } from './components/dropdown.svelte';
export type { DropdownPlacement, DropdownProps } from './components/dropdown.svelte';

export { default as EmptyState } from './components/empty-state.svelte';
export type { EmptyStateProps } from './components/empty-state.svelte';

export { default as Input } from './components/input.svelte';
export type { InputProps, InputType } from './components/input.svelte';

export { default as Kbd } from './components/kbd.svelte';
export type { KbdProps } from './components/kbd.svelte';

export { default as Label } from './components/label.svelte';
export type { LabelProps } from './components/label.svelte';

export { default as Modal } from './components/modal.svelte';
export type { ModalProps } from './components/modal.svelte';

export { default as NavigationBar } from './components/navigation-bar.svelte';
export type { NavigationBarProps } from './components/navigation-bar.svelte';

export { default as NavigationItem } from './components/navigation-item.svelte';
export type { NavigationItemProps } from './components/navigation-item.svelte';

export { default as PageLayout } from './components/page-layout.svelte';
export type { PageLayoutProps } from './components/page-layout.svelte';

export { default as Pagination } from './components/pagination.svelte';
export type { PaginationProps } from './components/pagination.svelte';

export { default as Progress } from './components/progress.svelte';
export type { ProgressProps, ProgressSize, ProgressVariant } from './components/progress.svelte';

export { default as Radio } from './components/radio.svelte';
export type { RadioProps } from './components/radio.svelte';

export { default as RadioGroup } from './components/radio-group.svelte';
export type { RadioGroupContext, RadioGroupProps } from './components/radio-group.svelte';

export { default as Select } from './components/select.svelte';
export type { SelectOption, SelectProps } from './components/select.svelte';

export { default as Skeleton } from './components/skeleton.svelte';
export type { SkeletonProps } from './components/skeleton.svelte';

export { default as Spinner } from './components/spinner.svelte';
export type { SpinnerProps, SpinnerSize } from './components/spinner.svelte';

export { default as Tab } from './components/tab.svelte';
export type { TabProps } from './components/tab.svelte';

export { default as TabList } from './components/tab-list.svelte';
export type { TabListProps } from './components/tab-list.svelte';

export { default as TabPanel } from './components/tab-panel.svelte';
export type { TabPanelProps } from './components/tab-panel.svelte';

export { default as Table } from './components/table.svelte';
export type { SortDirection, TableContext, TableProps, TableSort } from './components/table.svelte';

export { default as TableBody } from './components/table-body.svelte';
export type { TableBodyProps } from './components/table-body.svelte';

export { default as TableCell } from './components/table-cell.svelte';
export type { TableCellProps } from './components/table-cell.svelte';

export { default as TableHeader } from './components/table-header.svelte';
export type { TableHeaderProps } from './components/table-header.svelte';

export { default as TableHeaderCell } from './components/table-header-cell.svelte';
export type { TableHeaderCellProps } from './components/table-header-cell.svelte';

export { default as TableRow } from './components/table-row.svelte';
export type { TableRowProps } from './components/table-row.svelte';

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

export { useToast } from './utilities/use-toast.ts';

export { default as Toggle } from './components/toggle.svelte';
export type { ToggleProps } from './components/toggle.svelte';

export { default as Tooltip } from './components/tooltip.svelte';
export type { TooltipPlacement, TooltipProps } from './components/tooltip.svelte';

// ---------------------------------------------------------------------------
// Experimental components — exported under cinder/experimental/<name>. Their
// APIs may change between minor versions until they meet the canonical
// promotion criteria documented in COMPONENT-COVERAGE-PLAN.md.
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

export { default as Popover } from './components/experimental/popover.svelte';
export type { PopoverPlacement, PopoverProps } from './components/experimental/popover.svelte';

export { default as Sheet } from './components/experimental/sheet.svelte';
export type { SheetEdge, SheetProps, SheetSize } from './components/experimental/sheet.svelte';

export { default as Stat } from './components/experimental/stat.svelte';
export type { StatProps, StatTrend } from './components/experimental/stat.svelte';

export { default as Timeline } from './components/experimental/timeline.svelte';
export type { TimelineProps } from './components/experimental/timeline.svelte';

export { default as TimelineItem } from './components/experimental/timeline-item.svelte';
export type { TimelineItemProps } from './components/experimental/timeline-item.svelte';
