export type NestedObjectArrayTone = 'info' | 'success' | 'warning' | 'error';

export type NestedObjectArrayEntry = {
  /** Stable id. */
  id: string;
  /** Visible title. */
  title: string;
  /** Visual tone. @default "info" */
  tone?: NestedObjectArrayTone;
};

export interface NestedObjectArraySchemaProps {
  /**
   * Entries rendered in order.
   * @schemaObject
   */
  entries: NestedObjectArrayEntry[];
}
