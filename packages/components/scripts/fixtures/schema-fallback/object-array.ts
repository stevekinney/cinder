export type ObjectArrayItem = {
  /** Stable item identifier. */
  id?: string;
  /** Visible item label. */
  label: string;
};

export type ObjectArrayProps = {
  /** Items to render. */
  items: ObjectArrayItem[];
};
