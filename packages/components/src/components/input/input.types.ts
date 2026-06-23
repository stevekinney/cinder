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
      /** When true, the leading adornment is interactive and included in the accessibility tree. Default `false`. */
      leadingInteractive?: boolean;
      trailing?: never;
      trailingInteractive?: never;
    }
  | {
      leading?: never;
      leadingInteractive?: never;
      trailing: Snippet;
      /** When true, the trailing adornment is interactive and included in the accessibility tree. Default `false`. */
      trailingInteractive?: boolean;
    }
  | {
      leading: Snippet;
      /** When true, the leading adornment is interactive and included in the accessibility tree. Default `false`. */
      leadingInteractive?: boolean;
      trailing: Snippet;
      /** When true, the trailing adornment is interactive and included in the accessibility tree. Default `false`. */
      trailingInteractive?: boolean;
    };

export type InputProps = HTMLInputAttributes &
  InputAddonProps & {
    /** HTML `id` for the underlying input, used to associate the `<label>` and ARIA attributes. Required. */
    id: string;
    /** Bindable current text value of the input. */
    value: string;
    /** Visible label text rendered above the input and linked via `for`/`id`. */
    label?: string;
    /** Helper text rendered below the input and associated via `aria-describedby`. */
    description?: string;
    /** Error message rendered below the input; also sets `aria-invalid` on the input. */
    error?: string;
    /** When true, disables the input, matching the native `disabled` attribute. */
    disabled?: boolean;
    /** Marks the input as required for form validation, matching the native `required` attribute. */
    required?: boolean;
    /** Input type controlling the browser's built-in validation and keyboard. Default `"text"`. */
    type?: InputType;
    class?: string;
  };
