/**
 * Regression test that scans component source (and optionally built output) for
 * SVG data URIs containing hardcoded `fill` or `stroke` color literals.
 *
 * Hardcoded SVG colors don't respond to theme tokens — a light-mode `#9ca3af`
 * chevron disappears in dark mode. SVG data URIs must encode shapes only;
 * coloring is the job of `mask-image` + `background-color: currentColor`, or
 * inline `<svg>` with `fill="currentColor"` / `stroke="currentColor"`.
 *
 * Set `CINDER_SVG_DATA_URI_ROOTS` to a comma-separated list of paths to
 * override the default scan root (defaults to `packages/components/src`).
 */
import { Glob } from 'bun';
import { describe, expect, test } from 'bun:test';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

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
};

function resolveScanRoots(): string[] {
  const repoRoot = resolve(import.meta.dir, '..', '..', '..', '..');
  const fromEnv = process.env['CINDER_SVG_DATA_URI_ROOTS'];
  const roots = fromEnv
    ? fromEnv
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
    : ['packages/components/src'];
  return roots.map((root) => {
    const absolute = resolve(repoRoot, root);
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

function extractSvgDataUris(file: string, source: string): SvgDataUri[] {
  const results: SvgDataUri[] = [];
  const marker = 'data:image/svg+xml';
  let cursor = 0;
  while (cursor < source.length) {
    const start = source.indexOf(marker, cursor);
    if (start === -1) break;
    const trailingCharacter = source[start + marker.length];
    if (trailingCharacter !== ',' && trailingCharacter !== ';') {
      cursor = start + marker.length;
      continue;
    }

    let leading = '';
    for (let index = start - 1; index >= 0; index -= 1) {
      const character = source[index]!;
      if (character === '"' || character === "'" || character === '(') {
        leading = character;
        break;
      }
      if (character === '\n') break;
    }

    let endIndex = -1;
    if (leading === '"' || leading === "'") {
      let scan = start;
      while (scan < source.length) {
        const character = source[scan];
        if (character === '\\') {
          scan += 2;
          continue;
        }
        if (character === leading) {
          endIndex = scan;
          break;
        }
        scan += 1;
      }
      if (endIndex === -1) {
        throw new Error(
          `Unterminated quoted SVG data URI in ${file}: ${source.slice(start, start + 60)}`,
        );
      }
    } else if (leading === '(') {
      const closeParen = source.indexOf(')', start);
      if (closeParen === -1) {
        throw new Error(
          `Unterminated url() SVG data URI in ${file}: ${source.slice(start, start + 60)}`,
        );
      }
      endIndex = closeParen;
    } else {
      throw new Error(
        `SVG data URI not inside a quoted string or url(...) in ${file}: ${source.slice(
          start,
          start + 60,
        )}`,
      );
    }

    const raw = source.slice(start, endIndex);
    cursor = endIndex + 1;

    const commaIndex = raw.indexOf(',');
    if (commaIndex === -1) {
      throw new Error(`Malformed SVG data URI (missing comma) in ${file}: ${raw}`);
    }
    const metadata = raw.slice(marker.length, commaIndex);
    if (metadata.includes(';base64')) {
      throw new Error(`Base64 SVG data URI is not supported by the scanner; in ${file}: ${raw}`);
    }
    const allowedMetadata = new Set(['', ';charset=utf-8', ';utf8']);
    if (!allowedMetadata.has(metadata)) {
      throw new Error(`Unsupported SVG data URI metadata "${metadata}" in ${file}: ${raw}`);
    }

    const encodedPayload = raw.slice(commaIndex + 1);
    let payload: string;
    try {
      payload = decodeURIComponent(encodedPayload);
    } catch {
      throw new Error(`Malformed percent-encoding in SVG data URI in ${file}: ${encodedPayload}`);
    }

    results.push({ file, raw, payload });
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
