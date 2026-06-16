import { createContext } from 'svelte';

import type { SpeedDialContext } from './speed-dial.types.ts';

const [getSpeedDialContextStrict, setSpeedDialContext] = createContext<SpeedDialContext>();

export { setSpeedDialContext };

/** Read the nearest enclosing SpeedDial context. */
export const getSpeedDialContext = getSpeedDialContextStrict;
