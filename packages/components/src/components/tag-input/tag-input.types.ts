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

export interface TagInputSchemaProps {
  /** Maximum number of tags allowed. Non-finite values disable the cap. */
  max?: number;
  /** Stable id for the visible text input. Falls back to FormField context or a generated id. */
  id?: string;
  /** Controlled tags. When provided, the parent owns the tag array. */
  value?: string[];
  /** Initial tags for uncontrolled usage. Ignored after mount. */
  defaultValue?: string[];
  /** Key that commits the current input into a tag. Enter always commits separately. */
  delimiter?: string | RegExp;
  /** Allow the same trimmed tag value to appear more than once. */
  allowDuplicates?: boolean;
  /** Autocomplete hint forwarded to the visible text input. */
  autocomplete?: HTMLInputAttributes['autocomplete'];
  /** Autocapitalization hint forwarded to the visible text input. */
  autocapitalize?: HTMLInputAttributes['autocapitalize'];
  /** Virtual-keyboard Enter hint forwarded to the visible text input. */
  enterkeyhint?: HTMLInputAttributes['enterkeyhint'];
  /** Virtual-keyboard input mode forwarded to the visible text input. */
  inputmode?: HTMLInputAttributes['inputmode'];
  /** Maximum pending-text length forwarded to the visible text input. */
  maxlength?: HTMLInputAttributes['maxlength'];
  /** Placeholder text shown while the pending tag input is empty. */
  placeholder?: HTMLInputAttributes['placeholder'];
  /** Render the pending-tag input as read-only and make committed tags non-removable. */
  readonly?: boolean;
  /** Spellcheck setting forwarded to the visible text input. */
  spellcheck?: HTMLInputAttributes['spellcheck'];
  /** Disable the input and chip removal affordances. */
  disabled?: boolean;
  /** Hidden input name used for native form submission; one hidden field is rendered per tag. */
  name?: string;
  /** Additional class merged onto the root element. */
  class?: string;
  /** Accessible label applied when no labelled-by chain is present. */
  'aria-label'?: HTMLInputAttributes['aria-label'];
  /** Manual invalid-state override used when no inline validation message or FormField invalid state is active. */
  'aria-invalid'?: HTMLInputAttributes['aria-invalid'];
  /** Element ids that label both the text input and the committed-tag listbox. */
  'aria-labelledby'?: HTMLInputAttributes['aria-labelledby'];
  /** Additional description ids composed into the visible input aria-describedby chain. */
  'aria-describedby'?: HTMLInputAttributes['aria-describedby'];
  onblur?: HTMLInputAttributes['onblur'];
  onchange?: (tags: string[]) => void;
  onfocus?: HTMLInputAttributes['onfocus'];
  oninput?: HTMLInputAttributes['oninput'];
  onkeydown?: HTMLInputAttributes['onkeydown'];
  validate?: (tag: string) => boolean | string;
}
