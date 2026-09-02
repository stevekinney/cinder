import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import * as prettier from 'prettier';

const repositoryRoot = resolve(import.meta.dirname, '../../../..');

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** `JSON.parse` returns `any`; narrow it before trusting `.version`. */
function readManifestVersion(manifestPath: string): string {
  const parsed: unknown = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (!isRecord(parsed) || typeof parsed['version'] !== 'string') {
    throw new Error(`${manifestPath} has no string "version" field`);
  }
  return parsed['version'];
}

let checked: { version: string; resolvedFrom: string } | null = null;

/**
 * Every generated-artifact pipeline under `scripts/` formats with prettier, and
 * each one's "committed artifact matches regeneration" contract is implicitly
 * parameterized by whichever prettier that script happens to resolve. Nothing
 * pins it. Adding a workspace member with a different `prettier` range (#1425,
 * `labs/chat-room` at `^3.8.3`) made bun nest a fresh 3.9.x under each package's
 * own `node_modules`; the artifact pipeline then formatted with 3.9.6 while the
 * root stayed locked at 3.8.1, and 3.9's markdown printer moved blank lines
 * around the `<!-- generated:variables:* -->` markers -- so `components:check`
 * reported ~150 READMEs stale on a branch that never touched `packages/components`
 * (CIN-456).
 *
 * The invariant is not "one prettier in the lockfile" -- transitives such as
 * `@changesets/*` legitimately carry a nested 2.x -- but "the artifact pipeline
 * uses the ROOT's prettier". Compare against the version the root actually
 * resolves rather than a declared range, so a deliberate `bun update` at the root
 * is not a false positive while a shadow copy nested under this package is.
 *
 * Call it at every formatter entry point (manifest, agents-md, promotion
 * readiness, tokens, component artifacts). It checks once and memoizes, so the
 * per-call cost after the first is a null test.
 */
export function assertPrettierResolvesToRoot(): { version: string; resolvedFrom: string } {
  if (checked !== null) return checked;
  const resolvedFrom = import.meta.resolve('prettier');
  const rootPrettierManifest = join(repositoryRoot, 'node_modules', 'prettier', 'package.json');
  let rootVersion: string;
  try {
    rootVersion = readManifestVersion(rootPrettierManifest);
  } catch (error) {
    throw new Error(
      `cannot read the root prettier at ${rootPrettierManifest}; generated artifacts must be ` +
        `formatted with the root-locked prettier. This process resolved prettier ` +
        `${prettier.version} from ${resolvedFrom}.`,
      { cause: error },
    );
  }
  if (prettier.version !== rootVersion) {
    throw new Error(
      `prettier resolved to ${prettier.version} from ${resolvedFrom}, but the root locks ` +
        `${rootVersion} (${rootPrettierManifest}). A nested copy is shadowing the root's -- ` +
        `generated artifacts would silently track the wrong formatter. Align the workspace's ` +
        `prettier ranges so bun dedupes to the root copy.`,
    );
  }
  checked = { version: prettier.version, resolvedFrom };
  return checked;
}
