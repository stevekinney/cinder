import { format } from 'prettier';

import babelPlugin from 'prettier/plugins/babel';
import estreePlugin from 'prettier/plugins/estree';
import typescriptPlugin from 'prettier/plugins/typescript';
import type { AuthoringCatalogue } from '../../src/tokens/runtime/authoring-types.ts';
import { assertPrettierResolvesToRoot } from '../lib/prettier-resolution.ts';
import { PRETTIER_OPTIONS, REGENERATE_COMMAND } from './generator-configuration.ts';

const TYPESCRIPT_PLUGINS = [typescriptPlugin, estreePlugin, babelPlugin];

/**
 * The committed form: a typed TypeScript module, so the runtime subpath exports
 * the catalogue as checked data rather than as an untyped JSON import.
 */
export async function serializeAuthoringCatalogue(catalogue: AuthoringCatalogue): Promise<string> {
  assertPrettierResolvesToRoot();
  const source = `/**
 * GENERATED FILE. Do not edit by hand.
 *
 * The token authoring catalogue: one record per public registry entry.
 * Regenerate: ${REGENERATE_COMMAND}
 */

import type { AuthoringCatalogue } from './authoring-types.ts';

export const AUTHORING_CATALOGUE: AuthoringCatalogue = ${JSON.stringify(catalogue)};
`;
  return format(source, { ...PRETTIER_OPTIONS, parser: 'typescript', plugins: TYPESCRIPT_PLUGINS });
}
