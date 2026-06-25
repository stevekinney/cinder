export type DeepNestedObjectArrayTone = 'info' | 'warning';

export type DeepNestedObjectArrayDetail = {
  /** Detail identifier. */
  id: string;
  /** Detail content. */
  content: string;
};

export type DeepNestedObjectArrayChild = {
  /** Child identifier. */
  id: string;
  /** Child tone. */
  tone?: DeepNestedObjectArrayTone;
  /**
   * Child details rendered inline.
   * @schemaObject
   */
  details?: DeepNestedObjectArrayDetail[];
};

export type DeepNestedObjectArrayEntry = {
  /** Entry identifier. */
  id: string;
  /**
   * Nested children rendered under the entry.
   * @schemaObject
   */
  children?: DeepNestedObjectArrayChild[];
};

export interface DeepNestedObjectArraySchemaProps {
  /**
   * Entries rendered in order.
   * @schemaObject
   */
  entries: DeepNestedObjectArrayEntry[];
}
