/**
 * Generates a stable, incrementing ID for use in ARIA relationships.
 *
 * Unlike Math.random(), this counter is deterministic within a server render
 * or a browser session. Server and client IDs will differ in their counter value
 * if the rendering order differs, but for ARIA relationships (aria-controls,
 * aria-labelledby, aria-describedby) that reference elements rendered by the
 * SAME component instance, the IDs are always consistent between the server
 * render and client hydration of that instance.
 *
 * Note: For true SSR/hydration ID stability across the full tree, you would need
 * a framework-provided useId() equivalent. This is a pragmatic approximation for
 * in-component ARIA linkage where server and client agree on the instance order.
 */
let counter = 0;

export function useId(prefix: string): string {
  return `${prefix}-${++counter}`;
}
