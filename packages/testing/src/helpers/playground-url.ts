/**
 * The base URL of the cinder playground server that the browser-test suite
 * targets. Reads `PLAYGROUND_URL` from the environment so the suite can run
 * against a non-default host (e.g. a deploy preview); otherwise defaults to
 * the playground's local dev port. Single source of truth — config, fixture,
 * and scripts all consume this.
 */
export const PLAYGROUND_URL = process.env['PLAYGROUND_URL'] ?? 'http://localhost:5555';
