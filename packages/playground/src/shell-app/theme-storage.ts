/**
 * localStorage key for the persisted theme override.
 *
 * Lives in its own module so the documentation page and the shell's
 * `preview-store.svelte.ts` can share it without the page importing the store
 * (which pulls a much larger graph into every per-component bundle). The
 * pre-paint script in `render-shell.ts` reads this same key before first paint.
 */
export const THEME_STORAGE_KEY = 'cinder-playground-theme';
