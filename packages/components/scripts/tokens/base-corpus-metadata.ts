/**
 * Generates `base-corpus.generated.ts`: the package version and the source
 * digest of the bundled Cinder token base.
 *
 * The digest is computed over the validated corpus the generator loaded, with
 * the runtime's own canonical-JSON and SHA-256 code, so what is committed is
 * exactly what the runtime recomputes in the browser.
 */

import { join } from 'node:path';

import { format } from 'prettier';
import babelPlugin from 'prettier/plugins/babel';
import estreePlugin from 'prettier/plugins/estree';
import typescriptPlugin from 'prettier/plugins/typescript';

import { computeSourceDigest } from '../../src/tokens/runtime/source-digest.ts';
import type { ResolverDocument, TokenDocument } from '../../src/tokens/runtime/types.ts';
import { assertPrettierResolvesToRoot } from '../lib/prettier-resolution.ts';
import {
  PRETTIER_OPTIONS,
  REGENERATE_COMMAND,
  runtimeDirectory,
} from './generator-configuration.ts';

export const baseCorpusMetadataPath = join(runtimeDirectory, 'base-corpus.generated.ts');
export const packageVersionPath = join(runtimeDirectory, 'package-version.generated.ts');

/** Absolute output path -> generated content for the base-corpus metadata module. */
export async function buildBaseCorpusMetadata(
  resolver: ResolverDocument,
  documentsByPath: Map<string, TokenDocument>,
): Promise<Map<string, string>> {
  const digest = await computeSourceDigest({
    resolver,
    documents: Object.fromEntries(documentsByPath),
  });
  const source = `/**
 * GENERATED FILE. Do not edit by hand.
 *
 * The source digest of the bundled Cinder token base: a digest of the resolver
 * and documents only, so nothing that changes at publish time can alter it.
 * Regenerate: ${REGENERATE_COMMAND}
 */

export const BASE_SOURCE_DIGEST = ${JSON.stringify(digest)};
`;
  assertPrettierResolvesToRoot();
  const formatted = await format(source, {
    ...PRETTIER_OPTIONS,
    parser: 'typescript',
    plugins: [typescriptPlugin, estreePlugin, babelPlugin],
  });
  // The published version is not known to the workspace, which carries none. The mirror
  // transform rewrites this one literal to the composed manifest's version at sync time
  // (`versionConstants` in scripts/mirror/source.ts), so it must keep exactly this shape.
  const version = `/**
 * GENERATED FILE. Do not edit by hand.
 *
 * The version of \`@lostgradient/cinder\` these token sources ship in. The workspace
 * carries no version, so this is the sentinel \`workspace\`; the mirror substitutes
 * the published version when it composes the package.
 * Regenerate: ${REGENERATE_COMMAND}
 */
export const VERSION = 'workspace';
`;
  return new Map([
    [baseCorpusMetadataPath, formatted],
    [packageVersionPath, version],
  ]);
}
