import SpeedDialAction from '../speed-dial-action/speed-dial-action.svelte';
import './speed-dial.css';
import SpeedDialRoot from './speed-dial.svelte';

/**
 * `SpeedDial` is the parent compound component and namespace exposing the
 * action leaf as `SpeedDial.Action`. The leaf remains importable individually
 * from `@lostgradient/cinder/speed-dial-action`.
 */
const SpeedDial = Object.assign(SpeedDialRoot, {
  Action: SpeedDialAction,
});

export default SpeedDial;
export type {
  SpeedDialActionLabelPlacement,
  SpeedDialActionProps,
} from '../speed-dial-action/speed-dial-action.types.ts';
export type {
  SpeedDialContext,
  SpeedDialDirection,
  SpeedDialProps,
  SpeedDialSchemaProps,
} from './speed-dial.types.ts';
export { SpeedDial };
