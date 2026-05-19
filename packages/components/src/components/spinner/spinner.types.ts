export type SpinnerSize = 'sm' | 'md' | 'lg';

export type SpinnerProps = {
  size?: SpinnerSize;
  label?: string;
  class?: string;
};

export interface SpinnerSchemaProps {
  /** Spinner size. @default "md" */
  size?: SpinnerSize;
  /** Accessible loading label. @default "Loading" */
  label?: string;
  /** Extra classes appended to the root element. */
  class?: string;
}
