import type { HTMLAttributes } from 'svelte/elements';
export type KeyValueEntry = { key: string; value: string };
export type KeyValueEditorProps = Omit<HTMLAttributes<HTMLDivElement>, 'class'> & {
  entries?: KeyValueEntry[];
  onValueChange?: (entries: KeyValueEntry[]) => void;
  secret?: (key: string) => boolean;
  addLabel?: string;
  removeLabel?: (key: string) => string;
  class?: string;
};
