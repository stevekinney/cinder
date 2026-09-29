/**
 * The published `@lostgradient/cinder/knowledge` entry point, consumed by
 * `@lostgradient/cinder-mcp`.
 *
 * Corvidae relocated the implementation to `scripts/knowledge/`; the build
 * bundles `dist/cli/knowledge.js` from this path, so the subpath resolves to the
 * same `CinderKnowledge` surface the package has always published.
 */

export * from '../../scripts/knowledge/knowledge.ts';
