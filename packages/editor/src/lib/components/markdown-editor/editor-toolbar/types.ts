/**
 * Shared types for editor toolbar components.
 */

/**
 * Type for icon components (Lucide icons, etc.).
 *
 * Note: icon libraries type their components inconsistently (Lucide's legacy
 * Svelte package shipped class components that don't match Svelte 5's strict
 * `Component` signature), so we use `any` here. This is consolidated in one
 * place so it can be narrowed once every supported icon source is a Svelte 5
 * component.
 *
 * @see https://github.com/lucide-icons/lucide/issues/1568 for tracking
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type IconComponent = any;
