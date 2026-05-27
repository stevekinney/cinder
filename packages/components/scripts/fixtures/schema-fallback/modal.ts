export type ModalProps = {
  open: boolean;
  /** Path examples must keep C:\temp, `code`, and ${value} text intact. */
  title: string;
  role?: 'dialog' | 'alertdialog';
  describedById?: string;
};
