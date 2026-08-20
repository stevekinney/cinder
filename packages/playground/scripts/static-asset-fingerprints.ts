import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { extname, join, posix, relative } from 'node:path';

const IMMUTABLE_EXTENSIONS = new Set([
  '.avif',
  '.css',
  '.gif',
  '.ico',
  '.jpeg',
  '.jpg',
  '.js',
  '.mjs',
  '.otf',
  '.png',
  '.svg',
  '.ttf',
  '.webp',
  '.woff',
  '.woff2',
]);
const TEXT_EXTENSIONS = new Set(['', '.css', '.html', '.js', '.json', '.mjs', '.txt', '.xml']);

export type StaticAssetFingerprintResult = {
  /** Maps an exported mutable path to the content-addressed URL that replaces it. */
  fingerprintedUrlBySourceUrl: ReadonlyMap<string, string>;
};

function outputUrl(outputDirectory: string, filePath: string): string {
  return `/${relative(outputDirectory, filePath).replaceAll('\\', '/')}`;
}

async function filesIn(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries
      .toSorted((left, right) => left.name.localeCompare(right.name))
      .map(async (entry) => {
        const filePath = join(directory, entry.name);
        return entry.isDirectory() ? filesIn(filePath) : [filePath];
      }),
  );
  return nested.flat();
}

function immutableAsset(filePath: string): boolean {
  return IMMUTABLE_EXTENSIONS.has(extname(filePath).toLowerCase());
}

function textualAsset(filePath: string): boolean {
  return TEXT_EXTENSIONS.has(extname(filePath).toLowerCase());
}

function urlFromCssSpecifier(sourceUrl: string, specifier: string): string | null {
  if (/^(?:data:|https?:|#)/u.test(specifier)) return null;
  const base = new URL(`https://static-export.local${sourceUrl}`);
  return new URL(specifier, base).pathname;
}

function rewriteCssReferences(
  css: string,
  sourceUrl: string,
  fingerprintedUrlBySourceUrl: ReadonlyMap<string, string>,
): string {
  const replacement = (match: string, specifier: string): string => {
    const source = urlFromCssSpecifier(sourceUrl, specifier);
    const fingerprinted = source === null ? undefined : fingerprintedUrlBySourceUrl.get(source);
    return fingerprinted === undefined ? match : match.replace(specifier, fingerprinted);
  };

  return css
    .replace(/@import\s+(?:url\(\s*)?['"]?([^'"\s)]+)['"]?/gu, replacement)
    .replace(/url\(\s*['"]?([^'"\s)]+)['"]?\s*\)/gu, replacement);
}

function rewriteReferences(
  contents: string,
  sourceUrl: string,
  fingerprintedUrlBySourceUrl: ReadonlyMap<string, string>,
): string {
  let rewritten = contents;
  for (const [source, fingerprinted] of fingerprintedUrlBySourceUrl) {
    rewritten = rewritten.replaceAll(source, fingerprinted);
  }
  return extname(sourceUrl).toLowerCase() === '.css'
    ? rewriteCssReferences(rewritten, sourceUrl, fingerprintedUrlBySourceUrl)
    : rewritten;
}

/**
 * Replaces every emitted JS, CSS, font, and image with an URL containing the
 * complete static asset set's SHA-256 digest. A shared digest ensures that an
 * asset whose rewritten imports change also receives a new URL. Textual
 * references are rewritten before the old files are removed, so an immutable
 * URL can never serve changed bytes after a deploy.
 */
export async function fingerprintStaticAssets(
  outputDirectory: string,
): Promise<StaticAssetFingerprintResult> {
  const files = await filesIn(outputDirectory);
  const fingerprintedUrlBySourceUrl = new Map<string, string>();
  const bytesBySourceUrl = new Map<string, Uint8Array>();
  const assetSetHash = createHash('sha256');

  for (const filePath of files) {
    if (!immutableAsset(filePath)) continue;
    const sourceUrl = outputUrl(outputDirectory, filePath);
    const bytes = new Uint8Array(await readFile(filePath));
    bytesBySourceUrl.set(sourceUrl, bytes);
    assetSetHash.update(sourceUrl).update('\0').update(bytes).update('\0');
  }

  const assetSetDigest = assetSetHash.digest('hex');
  for (const sourceUrl of bytesBySourceUrl.keys()) {
    fingerprintedUrlBySourceUrl.set(
      sourceUrl,
      `/${posix.join('assets', assetSetDigest, sourceUrl.slice(1))}`,
    );
  }

  for (const filePath of files) {
    if (!textualAsset(filePath)) continue;
    const sourceUrl = outputUrl(outputDirectory, filePath);
    const contents = await readFile(filePath, 'utf8');
    const rewritten = rewriteReferences(contents, sourceUrl, fingerprintedUrlBySourceUrl);
    if (rewritten !== contents) await writeFile(filePath, rewritten);
  }

  for (const [sourceUrl, fingerprintedUrl] of fingerprintedUrlBySourceUrl) {
    const outputPath = join(outputDirectory, fingerprintedUrl.slice(1));
    await mkdir(posix.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, await readFile(join(outputDirectory, sourceUrl.slice(1))));
  }

  await Promise.all(
    [...fingerprintedUrlBySourceUrl.keys()].map((sourceUrl) =>
      rm(join(outputDirectory, sourceUrl.slice(1))),
    ),
  );
  return { fingerprintedUrlBySourceUrl };
}
