/**
 * Shared types for editor toolbar components.
 */

/**
 * Type for icon components (Lucide icons, etc.).
 *
 * Note: lucide-svelte icons don't match Svelte 5's strict `Component` type
 * signature, so we use `any` here. This is consolidated in one place so it
 * can be updated when lucide-svelte updates their type definitions.
 *
 * @see https://github.com/lucide-icons/lucide/issues/1568 for tracking
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type IconComponent = any;
