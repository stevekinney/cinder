import fs from 'node:fs';
import path from 'node:path';

const tagArg = process.argv.find((arg) => arg.startsWith('--tag='));
const explicitTag = tagArg ? tagArg.slice('--tag='.length) : undefined;
// `TAG_NAME` is the deliberate, workflow-supplied tag and must win over
// `GITHUB_REF_NAME`. On a `workflow_dispatch` run `GITHUB_REF_NAME` is the
// dispatch ref (the branch, e.g. `main`), NOT the release tag — so preferring it
// would always fail the version check even though the workflow checked out the
// correct `refs/tags/vX.Y.Z` and passed `TAG_NAME` explicitly.
const refTag = process.env['TAG_NAME'] ?? process.env['GITHUB_REF_NAME'] ?? '';
const tag = explicitTag ?? refTag;

if (!tag) {
  process.stderr.write('Missing tag name. Provide --tag=vX.Y.Z or set GITHUB_REF_NAME.\n');
  process.exit(1);
}

const normalizedTag = tag.startsWith('v') ? tag.slice(1) : tag;
const pkgPath = path.join(process.cwd(), 'package.json');
const parsed: unknown = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

function hasStringVersion(value: unknown): value is { version: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'version' in value &&
    typeof (value as { version: unknown }).version === 'string'
  );
}

if (!hasStringVersion(parsed)) {
  process.stderr.write('package.json is missing a version field.\n');
  process.exit(1);
}

if (parsed.version !== normalizedTag) {
  process.stderr.write(
    `Version mismatch: package.json=${parsed.version} tag=${tag}. ` +
      'Update package.json or retag the release.\n',
  );
  process.exit(1);
}

process.stdout.write(`Release version verified: ${tag}\n`);
