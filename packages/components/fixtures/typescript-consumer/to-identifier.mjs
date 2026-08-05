/**
 * Convert a kebab-case component id to a TypeScript-safe PascalCase
 * identifier segment. Extracted from `generate-probe.mjs` (unchanged) so
 * `generate-readme-usage-examples.mjs` can share it without importing
 * `generate-probe.mjs` itself — that file has no `if (import.meta.main)`
 * guard, so importing it as a module would immediately execute its full
 * probe-generation side effects.
 */
export function toIdentifier(id) {
  return id
    .split(/[-/]/)
    .filter(Boolean)
    .map((segment) => segment[0].toUpperCase() + segment.slice(1))
    .join('');
}
