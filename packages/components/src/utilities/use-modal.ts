import { getModalContext, type ModalApi } from '../_internal/modal-context.ts';

export function useModal(): ModalApi {
  return getModalContext();
}

export type {
  ModalApi,
  ModalContentControls,
  OpenModalOptions,
} from '../_internal/modal-context.ts';
