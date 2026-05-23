import type { HTMLInputAttributes } from 'svelte/elements';

type SupportedInputAttributes = Pick<
  HTMLInputAttributes,
  | 'aria-describedby'
  | 'aria-invalid'
  | 'aria-label'
  | 'aria-labelledby'
  | 'autocomplete'
  | 'autocapitalize'
  | 'enterkeyhint'
  | 'inputmode'
  | 'maxlength'
  | 'onblur'
  | 'onfocus'
  | 'oninput'
  | 'onkeydown'
  | 'placeholder'
  | 'spellcheck'
>;

export type TagInputProps = SupportedInputAttributes & {
  /** Stable id for the visible text input. Falls back to FormField context or a generated id. */
  id?: string;
  /** Controlled tags. When provided, the parent owns the tag array. */
  value?: string[];
  /** Initial tags for uncontrolled usage. Ignored after mount. */
  defaultValue?: string[];
  /** Key that commits the current input into a tag. Enter always commits separately. */
  delimiter?: string | RegExp;
  /** Maximum number of tags allowed. Non-finite values disable the cap. */
  max?: number;
  /** Optional per-tag validation hook. */
  validate?: (tag: string) => boolean | string;
  /** Allow the same trimmed tag value to appear more than once. */
  allowDuplicates?: boolean;
  /** Disable the input and chip removal affordances. */
  disabled?: boolean;
  /** Render the pending-tag input as read-only and make committed tags non-removable. */
  readonly?: boolean;
  /** Hidden input name used for native form submission. */
  name?: string;
  /** Additional class merged onto the root element. */
  class?: string;
  /** Fires whenever a commit or removal requests a new tag list. */
  onchange?: (tags: string[]) => void;
};
