import type { Snippet } from 'svelte';
import type { HTMLInputAttributes } from 'svelte/elements';

export type InputType =
  | 'text'
  | 'email'
  | 'password'
  | 'search'
  | 'tel'
  | 'url'
  | 'date'
  | 'number';

type InputAddonProps =
  | { leading?: never; leadingInteractive?: never; trailing?: never; trailingInteractive?: never }
  | {
      leading: Snippet;
      leadingInteractive?: boolean;
      trailing?: never;
      trailingInteractive?: never;
    }
  | {
      leading?: never;
      leadingInteractive?: never;
      trailing: Snippet;
      trailingInteractive?: boolean;
    }
  | {
      leading: Snippet;
      leadingInteractive?: boolean;
      trailing: Snippet;
      trailingInteractive?: boolean;
    };

export type InputProps = HTMLInputAttributes &
  InputAddonProps & {
    id: string;
    value: string;
    label?: string;
    description?: string;
    error?: string;
    disabled?: boolean;
    required?: boolean;
    type?: InputType;
    class?: string;
  };
