import type { HTMLAttributes } from 'svelte/elements';

export type InlineLoadingStatus = 'inactive' | 'active' | 'finished' | 'error';

export type InlineLoadingProps = Omit<HTMLAttributes<HTMLSpanElement>, 'class'> & {
  /**
   * Lifecycle state for the inline async action indicator. Bindable: the
   * component resets this to `"inactive"` after the `successDelay` timer fires
   * so a subsequent `status = "finished"` from the parent is always a real
   * value transition that re-shows the success indicator.
   * @default "inactive"
   */
  status?: InlineLoadingStatus;
  /** Visible status label rendered next to the indicator. */
  description?: string;
  /** Accessible status wording used by announcements when no visible description is provided. */
  iconDescription?: string;
  /** Delay in milliseconds before auto-resetting `finished` back to `inactive`. @default 1500 */
  successDelay?: number;
  /** Extra classes appended to the root element. */
  class?: string;
};

export interface InlineLoadingSchemaProps {
  /**
   * Lifecycle state for the inline async action indicator. Bindable: the
   * component resets this to `"inactive"` after the `successDelay` timer fires
   * so a subsequent `status = "finished"` from the parent is always a real
   * value transition that re-shows the success indicator.
   * @default "inactive"
   */
  status?: InlineLoadingStatus;
  /** Visible status label rendered next to the indicator. */
  description?: string;
  /** Accessible status wording used by announcements when no visible description is provided. */
  iconDescription?: string;
  /** Delay in milliseconds before auto-resetting `finished` back to `inactive`. @default 1500 */
  successDelay?: number;
  /** Extra classes appended to the root element. */
  class?: string;
}
