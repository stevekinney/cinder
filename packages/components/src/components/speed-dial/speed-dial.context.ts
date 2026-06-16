import { createContext } from 'svelte';

import type { SpeedDialContext } from './speed-dial.types.ts';

const [getSpeedDialContextStrict, setSpeedDialContext] = createContext<SpeedDialContext>();

export { setSpeedDialContext };

/** Read the nearest enclosing SpeedDial context. */
export function getSpeedDialContext(): SpeedDialContext {
  try {
    return getSpeedDialContextStrict();
  } catch {
    throw new Error('SpeedDial.Action must be rendered inside a SpeedDial parent.');
  }
}
