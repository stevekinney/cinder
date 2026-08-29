import '../button/button.css';
import '../popover/popover.css';
import GuidanceRegion from './guidance-region.svelte';
export default GuidanceRegion;
export { useGuidance } from '../../utilities/use-guidance.ts';
export type { GuidanceApi, GuidanceClaim, GuidanceStorage } from '../../utilities/use-guidance.ts';
export type { GuidanceRegionProps } from './guidance-region.types.ts';
export { GuidanceRegion };
