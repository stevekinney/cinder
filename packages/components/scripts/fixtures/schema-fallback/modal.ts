export type ModalProps = {
  open: boolean;
  /** Path examples must keep a single escaped backslash like C:\temp. */
  title: string;
  role?: 'dialog' | 'alertdialog';
  describedById?: string;
};
