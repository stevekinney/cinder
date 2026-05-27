export type ModalProps = {
  open: boolean;
  title: string;
  role?: 'dialog' | 'alertdialog';
  describedById?: string;
};
