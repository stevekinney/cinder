import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

export type FormSubmitContext = { submitting: boolean };
export interface FormSchemaProps {
  /** Additional class merged with `.cinder-form`. */
  class?: string;
}
export type FormProps = Omit<HTMLAttributes<HTMLFormElement>, 'onsubmit' | 'children'> & {
  /** May return a promise; while pending, the child snippet receives `{ submitting: true }` and duplicate submits are ignored until it settles. */
  onSubmit?: (event: SubmitEvent) => void | Promise<void>;
  /** Form controls. Receives `{ submitting }` so descendants can disable themselves while `onSubmit` is pending. */
  children?: Snippet<[FormSubmitContext]>;
  class?: string;
};
