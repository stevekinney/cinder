import fs from 'node:fs';
import path from 'node:path';

const tagArg = process.argv.find((arg) => arg.startsWith('--tag='));
const explicitTag = tagArg ? tagArg.slice('--tag='.length) : undefined;
const refTag = process.env['GITHUB_REF_NAME'] ?? process.env['TAG_NAME'] ?? '';
const tag = explicitTag ?? refTag;

if (!tag) {
  console.error('Missing tag name. Provide --tag=vX.Y.Z or set GITHUB_REF_NAME.');
  process.exit(1);
}

const normalizedTag = tag.startsWith('v') ? tag.slice(1) : tag;
const pkgPath = path.join(process.cwd(), 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { version?: string };

if (!pkg.version) {
  console.error('package.json is missing a version field.');
  process.exit(1);
}

if (pkg.version !== normalizedTag) {
  console.error(
    `Version mismatch: package.json=${pkg.version} tag=${tag}. ` +
      'Update package.json or retag the release.',
  );
  process.exit(1);
}

console.log(`Release version verified: ${tag}`);
