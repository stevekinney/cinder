import { dirname, join } from 'node:path';

export const PLAYGROUND_ROOT = dirname(import.meta.dirname);
export const PLAYGROUND_TEMP_ROOT = join(PLAYGROUND_ROOT, '.tmp');
