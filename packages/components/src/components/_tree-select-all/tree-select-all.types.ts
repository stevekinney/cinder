/** Props for the TreeSelectAll component. */
export type TreeSelectAllProps = {
  /** Parent whose direct registered children are targeted. null targets root-level items. */
  parentId?: string | null;
  /** Include each target child's selection scope as well as the direct child id. */
  includeDescendants?: boolean;
  /** Text label shown before the action buttons. */
  label?: string;
  /** Label for the select-all action. */
  selectAllLabel?: string;
  /** Label for the select-none action. */
  selectNoneLabel?: string;
  /** Additional class merged with `.cinder-tree-select-all`. */
  class?: string;
};
