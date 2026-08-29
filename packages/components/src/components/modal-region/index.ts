import '../button/button.css';
import '../confirm-dialog/confirm-dialog.css';
import '../modal/modal.css';
import ModalRegion from './modal-region.svelte';
export default ModalRegion;
export { useModal } from '../../utilities/use-modal.ts';
export type {
  ModalApi,
  ModalContentControls,
  OpenModalOptions,
} from '../../utilities/use-modal.ts';
export type { ModalRegionProps } from './modal-region.types.ts';
export { ModalRegion };
