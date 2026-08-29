import type { Component } from 'svelte';
import { createContext } from 'svelte';

export type ModalComponent = Component<Record<string, unknown>>;
export type ModalEntry = {
  id: string;
  component: ModalComponent;
  props: Record<string, unknown>;
  resolve: (value: unknown) => void;
  promise?: Promise<unknown>;
  ownsModal?: boolean;
  settled?: boolean;
  confirmation?: boolean;
};

export type ModalApi = {
  openModal: <T extends Record<string, unknown> = Record<string, unknown>>(
    component: Component<T>,
    props?: T & { id?: string },
  ) => Promise<unknown>;
  confirm: (options: {
    title: string;
    description?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
    id?: string;
  }) => Promise<boolean>;
};

const [getModalContext, setModalContext] = createContext<ModalApi>();
export { getModalContext, setModalContext };
