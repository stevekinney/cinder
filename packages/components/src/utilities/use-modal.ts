import { getModalContext, type ModalApi } from '../_internal/modal-context.ts';

export function useModal(): ModalApi {
  return getModalContext();
}

export type { ModalApi } from '../_internal/modal-context.ts';
