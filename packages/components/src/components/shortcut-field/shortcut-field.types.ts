import type { HTMLAttributes } from 'svelte/elements';
export type ShortcutFieldProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  'class' | 'children' | 'role'
> & {
  value?: string[];
  onValueChange?: (value: string[]) => void;
  validate?: (value: string[]) => string | undefined;
  label?: string;
  disabled?: boolean;
  class?: string;
};
