import './toast-region.css';
import ToastRegion from './toast-region.svelte';

export default ToastRegion;
export { useToast } from '../../utilities/use-toast.ts';
export type {
  ToastApi,
  ToastItem,
  ToastOptions,
  ToastPosition,
  ToastRegionProps,
  ToastVariant,
} from './toast-region.types.ts';
export { ToastRegion };
