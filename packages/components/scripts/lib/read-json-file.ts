/**
 * Trusted-local-file JSON readers for build and CI scripts.
 *
 * TRUST BOUNDARY: use these only for JSON files owned and produced by this
 * repository's own build/CI pipeline — the package's `package.json`, generated
 * manifests, and generated schema JSON. The `as T` assertion is intentional and
 * reviewed: the pipeline produces these files, so their shape is an invariant of
 * the pipeline, not an external contract that needs runtime validation.
 *
 * Do NOT use these for user input, network responses, or third-party archives
 * whose shape this repository does not control. For those, validate the fields
 * you actually read with an explicit type guard before trusting them. (See
 * `derive-upstream-reexports.ts` for an example of guarding genuinely external
 * upstream manifests.)
 */

import { file } from 'bun';

/**
 * Read and JSON-parse a local file produced by this pipeline, typed as `T`.
 *
 * @see the module-level trust-boundary note before adding new call sites.
 */
export async function readJsonFile<T>(path: string): Promise<T> {
  // eslint-disable-next-line no-unsafe-type-assertion -- trusted local pipeline file; see module trust-boundary note.
  return (await file(path).json()) as T;
}

/**
 * JSON-parse a string sourced from a local file produced by this pipeline,
 * typed as `T`.
 *
 * @see the module-level trust-boundary note before adding new call sites.
 */
export function parseJsonFile<T>(text: string): T {
  // eslint-disable-next-line no-unsafe-type-assertion -- trusted local pipeline file; see module trust-boundary note.
  return JSON.parse(text) as T;
}
