import { DEV } from 'esm-env';

/**
 * Emit a development-only `console.warn`.
 *
 * Component contract-misuse warnings (a missing required prop, an id that does
 * not match the wrapping FormField, a duplicate key, …) are diagnostics for the
 * developer building the app — never for the end user. Routing them through
 * `devWarn` instead of a bare `console.warn` means:
 *
 * - **They are stripped from production bundles.** `DEV` from `esm-env` resolves
 *   to a literal `false` under a production build, so a bundler dead-code-
 *   eliminates the whole call. End users never see internal naming, and the
 *   warning string is not shipped.
 * - **One named, greppable seam.** Every diagnostic flows through one helper, so
 *   the policy ("warnings are dev-only") is enforceable with a single lint rule
 *   that bans bare `console.warn` in component source.
 *
 * Prefer calling this from a plain guard at the point of misuse rather than from
 * a `$effect` whose only purpose is to warn — a reactive effect kept alive solely
 * to log re-subscribes on every state change for no runtime benefit.
 *
 * @param message The warning message. Conventionally prefixed with the component
 *   tag, e.g. `[cinder/Select] …`.
 * @param args Additional values forwarded to `console.warn` (objects, ids, …).
 */
export function devWarn(message: string, ...args: unknown[]): void {
  if (!DEV) return;
  console.warn(message, ...args);
}
