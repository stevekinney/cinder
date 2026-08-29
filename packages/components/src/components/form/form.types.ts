import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

export type FormSubmitContext = { submitting: boolean };
export interface FormSchemaProps {
  /** Additional class merged with `.cinder-form`. */
  class?: string;
}
export type FormProps = Omit<HTMLAttributes<HTMLFormElement>, 'onsubmit' | 'children'> & {
  onSubmit?: (event: SubmitEvent) => void | Promise<void>;
  children?: Snippet<[FormSubmitContext]>;
  class?: string;
};
