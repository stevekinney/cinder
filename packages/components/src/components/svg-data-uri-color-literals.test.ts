/**
 * Regression test that scans component source for SVG data URIs containing
 * hardcoded `fill` or `stroke` color literals. Defaults to scanning
 * `components/cinder/src` only — set `CINDER_SVG_DATA_URI_ROOTS` to a
 * comma-separated list of paths to override the default roots (the build
 * verification step in the task plan passes
 * `components/cinder/src,components/cinder/dist` to also catch hardcoded literals
 * leaking through generated artifacts).
 *
 * Hardcoded SVG colors don't respond to theme tokens — a light-mode `#9ca3af`
 * chevron disappears in dark mode. SVG data URIs must encode shapes only;
 * coloring is the job of `mask-image` + `background-color: currentColor`, or
 * inline `<svg>` with `fill="currentColor"` / `stroke="currentColor"`.
 *
 * The one exception is an SVG data URI that an `<img>` loads as its `src`. An
 * image document never inherits the host page's color, so `currentColor`
 * inside it cannot follow the theme (CIN-61: the Image example's illustration
 * rendered near-black on a near-black dark theme). Image content therefore
 * carries its own explicit colors, and the scanner skips URIs it can see are
 * bound to `src`, either written directly into `src="…"` or assigned to a
 * `const` that the same source passes as `src={name}`. CSS `url(...)` values and
 * every other usage stay checked.
 */
import { Glob } from 'bun';
import { describe, expect, test } from 'bun:test';
import { readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { environmentConfiguration } from '../../scripts/environment-configuration.ts';

const ALLOWED_COLOR_VALUES = new Set(['none', 'currentcolor', 'inherit']);
const SCANNED_EXTENSIONS = new Set([
  'css',
  'svelte',
  'ts',
  'js',
  'mjs',
  'cjs',
  'json',
  'md',
  'html',
]);

type SvgDataUri = {
  readonly file: string;
  readonly raw: string;
  readonly payload: string;
  readonly isImageSource: boolean;
};

const IMAGE_SOURCE_LOOKBEHIND = 160;

/** Undo the JSON string escapes that example artifacts wrap their Svelte source in. */
function unescapeJsonQuoting(text: string): string {
  return text.replaceAll('\\n', '\n').replaceAll('\\"', '"');
}

/**
 * Whether the data URI starting at `start` is the `src` of an image: written
 * directly as `src="…"` / `src={'…'}`, or assigned to a `const` whose every
 * other reference in the same source is a `src={name}` binding. A constant that
 * also feeds CSS or anything else stays checked.
 */
function isImageSourceUri(source: string, start: number): boolean {
  const prefix = unescapeJsonQuoting(
    source.slice(Math.max(0, start - IMAGE_SOURCE_LOOKBEHIND), start),
  );
  if (/\bsrc\s*=\s*\{?\s*["'`]$/.test(prefix)) return true;
  const assignment = /\bconst\s+([A-Za-z_$][\w$]*)\s*(?::\s*string\s*)?=\s*["'`]$/.exec(prefix);
  if (assignment === null) return false;
  const name = assignment[1]!.replaceAll('$', '\\$');
  const unescaped = unescapeJsonQuoting(source);
  const references = unescaped.match(new RegExp(`(?<![\\w$])${name}(?![\\w$])`, 'g'))?.length ?? 0;
  const imageSources =
    unescaped.match(new RegExp(`\\bsrc\\s*=\\s*\\{\\s*${name}\\s*\\}`, 'g'))?.length ?? 0;
  return imageSources > 0 && references === imageSources + 1;
}

function resolveScanRoots(): string[] {
  const repoRoot = resolve(import.meta.dir, '..', '..', '..', '..');
  const fromEnv = environmentConfiguration().cinderSvgDataUriRoots;
  const roots = fromEnv
    ? fromEnv
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
    : undefined;
  return (roots ?? [join(resolve(import.meta.dir, '..', '..'), 'src')]).map((root) => {
    const absolute = roots ? resolve(repoRoot, root) : root;
    let exists = false;
    try {
      exists = statSync(absolute).isDirectory();
    } catch {
      exists = false;
    }
    if (!exists) {
      throw new Error(`SVG data URI scan root does not exist: ${absolute}`);
    }
    return absolute;
  });
}

function shouldScanFile(filePath: string): boolean {
  if (filePath.endsWith('.map')) return false;
  const extension = filePath.split('.').pop();
  if (!extension) return false;
  return SCANNED_EXTENSIONS.has(extension);
}

function readTextOrThrow(filePath: string): string {
  const buffer = readFileSync(filePath);
  if (buffer.includes(0)) {
    throw new Error(`File contains NUL bytes; cannot scan as text: ${filePath}`);
  }
  return buffer.toString('utf8');
}

function findUriLeadingCharacter(source: string, start: number): string {
  for (let index = start - 1; index >= 0; index -= 1) {
    const character = source[index]!;
    if (character === '"' || character === "'" || character === '(') return character;
    if (character === '\n') break;
  }
  return '';
}

function findUriEnd(file: string, source: string, start: number, markerLength: number): number {
  const leading = findUriLeadingCharacter(source, start);
  if (leading === '(') {
    const closeParen = source.indexOf(')', start);
    if (closeParen !== -1) return closeParen;
    throw new Error(
      `Unterminated url() SVG data URI in ${file}: ${source.slice(start, start + 60)}`,
    );
  }
  if (leading !== '"' && leading !== "'") {
    throw new Error(
      `SVG data URI not inside a quoted string or url(...) in ${file}: ${source.slice(
        start,
        start + 60,
      )}`,
    );
  }
  for (let scan = start + markerLength; scan < source.length; scan += 1) {
    const character = source[scan];
    if (character === '\\') {
      scan += 1;
      continue;
    }
    if (character === leading) return scan;
  }
  throw new Error(
    `Unterminated quoted SVG data URI in ${file}: ${source.slice(start, start + 60)}`,
  );
}

function decodeSvgPayload(file: string, raw: string, markerLength: number): string {
  const commaIndex = raw.indexOf(',');
  if (commaIndex === -1)
    throw new Error(`Malformed SVG data URI (missing comma) in ${file}: ${raw}`);
  const metadata = raw.slice(markerLength, commaIndex);
  if (metadata.includes(';base64')) {
    throw new Error(`Base64 SVG data URI is not supported by the scanner; in ${file}: ${raw}`);
  }
  if (!new Set(['', ';charset=utf-8', ';utf8']).has(metadata)) {
    throw new Error(`Unsupported SVG data URI metadata "${metadata}" in ${file}: ${raw}`);
  }
  const encodedPayload = raw.slice(commaIndex + 1);
  try {
    return decodeURIComponent(encodedPayload);
  } catch {
    throw new Error(`Malformed percent-encoding in SVG data URI in ${file}: ${encodedPayload}`);
  }
}

function extractSvgDataUris(file: string, source: string): SvgDataUri[] {
  const results: SvgDataUri[] = [];
  const marker = 'data:image/svg+xml';
  let cursor = 0;
  while (cursor < source.length) {
    const start = source.indexOf(marker, cursor);
    if (start === -1) break;
    if (source[start + marker.length] !== ',' && source[start + marker.length] !== ';') {
      cursor = start + marker.length;
      continue;
    }
    const endIndex = findUriEnd(file, source, start, marker.length);
    const raw = source.slice(start, endIndex);
    cursor = endIndex + 1;
    results.push({
      file,
      raw,
      payload: decodeSvgPayload(file, raw, marker.length),
      isImageSource: isImageSourceUri(source, start),
    });
  }
  return results;
}

function findOffendingAttribute(payload: string): { attribute: string; value: string } | null {
  const attributePattern = /\b(fill|stroke)\s*=\s*"([^"]*)"|\b(fill|stroke)\s*=\s*'([^']*)'/g;
  let match: RegExpExecArray | null;
  while ((match = attributePattern.exec(payload)) !== null) {
    const attribute = (match[1] ?? match[3])!;
    const value = (match[2] ?? match[4])!.trim();
    if (!ALLOWED_COLOR_VALUES.has(value.toLowerCase())) {
      return { attribute, value };
    }
  }
  return null;
}

function findOffendingDeclaration(
  payload: string,
  scope: 'inline-style' | 'style-block',
): { property: string; value: string } | null {
  const blocks: string[] = [];
  if (scope === 'inline-style') {
    const inlinePattern = /style\s*=\s*"([^"]*)"|style\s*=\s*'([^']*)'/g;
    let match: RegExpExecArray | null;
    while ((match = inlinePattern.exec(payload)) !== null) {
      blocks.push((match[1] ?? match[2])!);
    }
  } else {
    const stylePattern = /<style\b[^>]*>([\s\S]*?)<\/style>/g;
    let match: RegExpExecArray | null;
    while ((match = stylePattern.exec(payload)) !== null) {
      blocks.push(match[1]!);
    }
  }
  for (const block of blocks) {
    const declarationPattern = /\b(fill|stroke)\s*:\s*([^;}\n]+)/g;
    let declarationMatch: RegExpExecArray | null;
    while ((declarationMatch = declarationPattern.exec(block)) !== null) {
      const property = declarationMatch[1]!;
      const value = declarationMatch[2]!.trim();
      if (!ALLOWED_COLOR_VALUES.has(value.toLowerCase())) {
        return { property, value };
      }
    }
  }
  return null;
}

async function scanRoot(root: string): Promise<SvgDataUri[]> {
  const glob = new Glob('**/*');
  const uris: SvgDataUri[] = [];
  for await (const relative of glob.scan({ cwd: root, dot: false, onlyFiles: true })) {
    if (!shouldScanFile(relative)) continue;
    const absolute = resolve(root, relative);
    const source = readTextOrThrow(absolute);
    if (!source.includes('data:image/svg+xml')) continue;
    uris.push(...extractSvgDataUris(absolute, source));
  }
  return uris;
}

describe('SVG data URI color literals', () => {
  test('no decoded SVG data URI contains hardcoded fill or stroke colors', async () => {
    const roots = resolveScanRoots();
    const violations: string[] = [];

    for (const root of roots) {
      const uris = await scanRoot(root);
      for (const uri of uris) {
        if (uri.isImageSource) continue;
        const attributeOffense = findOffendingAttribute(uri.payload);
        if (attributeOffense) {
          violations.push(
            `${uri.file}: SVG data URI attribute ${attributeOffense.attribute}="${attributeOffense.value}" — use mask-image with currentColor instead. Raw URI: ${uri.raw}`,
          );
          continue;
        }
        const inlineOffense = findOffendingDeclaration(uri.payload, 'inline-style');
        if (inlineOffense) {
          violations.push(
            `${uri.file}: SVG data URI inline style ${inlineOffense.property}: ${inlineOffense.value} — use mask-image with currentColor instead. Raw URI: ${uri.raw}`,
          );
          continue;
        }
        const styleOffense = findOffendingDeclaration(uri.payload, 'style-block');
        if (styleOffense) {
          violations.push(
            `${uri.file}: SVG data URI <style> declaration ${styleOffense.property}: ${styleOffense.value} — use mask-image with currentColor instead. Raw URI: ${uri.raw}`,
          );
        }
      }
    }

    expect(violations).toEqual([]);
  });
});

describe('image source detection', () => {
  // Assembled so this file's own scan does not see a literal hardcoded-fill URI.
  const uri = ['data:image/svg+xml', "%3Csvg%3E%3Crect fill='%23f1f5f9'/%3E%3C/svg%3E"].join(',');

  test('treats a URI written directly into src as image content', () => {
    const source = `<img src="${uri}" alt="" />`;
    expect(isImageSourceUri(source, source.indexOf('data:'))).toBe(true);
  });

  test('treats a const passed as src as image content', () => {
    const source = `<script>\n  const imageSource =\n    "${uri}";\n</script>\n<Image src={imageSource} />`;
    expect(isImageSourceUri(source, source.indexOf('data:'))).toBe(true);
  });

  test('sees through the JSON escaping of a committed examples artifact', () => {
    const code = `<script>\n  const imageSource =\n    "${uri}";\n</script>\n<Image src={imageSource} />`;
    const source = JSON.stringify({ code });
    expect(isImageSourceUri(source, source.indexOf('data:'))).toBe(true);
  });

  test('keeps checking a const that never reaches src', () => {
    const source = `const chevron = "${uri}";\nconst style = \`background: url(\${chevron})\`;`;
    expect(isImageSourceUri(source, source.indexOf('data:'))).toBe(false);
  });

  test('keeps checking a const that reaches src and also feeds CSS', () => {
    const source = `<script>\n  const art = "${uri}";\n</script>\n<img src={art} alt="" />\n<div style="background: url({art})"></div>`;
    expect(isImageSourceUri(source, source.indexOf('data:'))).toBe(false);
  });

  test('keeps checking CSS url() values', () => {
    const source = `.select { background-image: url("${uri}"); }`;
    expect(isImageSourceUri(source, source.indexOf('data:'))).toBe(false);
  });

  test('still reports a hardcoded fill in a CSS url() through the scanner', () => {
    const [found] = extractSvgDataUris('chevron.css', `.x { background: url("${uri}"); }`);
    expect(found?.isImageSource).toBe(false);
    expect(found === undefined ? null : findOffendingAttribute(found.payload)).toEqual({
      attribute: 'fill',
      value: '#f1f5f9',
    });
  });
});
