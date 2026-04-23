import fs from 'node:fs';
import path from 'node:path';

const tagArg = process.argv.find((arg) => arg.startsWith('--tag='));
const explicitTag = tagArg ? tagArg.slice('--tag='.length) : undefined;
const refTag = process.env['GITHUB_REF_NAME'] ?? process.env['TAG_NAME'] ?? '';
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
