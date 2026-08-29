import type { Component } from 'svelte';
import { createContext } from 'svelte';

export type ModalComponent = Component<Record<string, unknown>>;
export type ModalEntry = {
  key: number;
  id: string;
  component: ModalComponent;
  props: Record<string, unknown>;
  title: string;
  resolve: (value: unknown) => void;
  promise?: Promise<unknown>;
  ownsModal?: boolean;
  settled?: boolean;
  confirmation?: boolean;
};

export type ModalContentControls<Result = unknown> = {
  resolve: (value: Result) => void;
  close: () => void;
};
export type OpenModalOptions = { title: string };

export type ModalApi = {
  openModal: <T extends Record<string, unknown> = Record<string, unknown>>(
    component: Component<T>,
    props: Omit<T, 'modal'> & { id?: string },
    options: OpenModalOptions,
  ) => Promise<unknown>;
  confirm: (options: {
    title: string;
    description?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
    id?: string;
  }) => Promise<boolean>;
  dismiss: (id: string) => void;
};

const [getModalContext, setModalContext] = createContext<ModalApi>();
export { getModalContext, setModalContext };
