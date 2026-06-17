/** Props for the TreeExpandAll component. */
export type TreeExpandAllProps = {
  /** Text label shown before the action buttons. */
  label?: string;
  /** Label for the full expand action. */
  expandAllLabel?: string;
  /** Label for the one-level expand action shown on large trees. */
  expandOneLevelLabel?: string;
  /** Label for the collapse-all action. */
  collapseAllLabel?: string;
  /** Branch count above which a one-level expand safety action is shown. */
  safetyThreshold?: number;
  /** Additional class merged with `.cinder-tree-expand-all`. */
  class?: string;
};
