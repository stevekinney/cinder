import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  CORPUS_ALIASES,
  CORPUS_DOCUMENTS,
  CORPUS_TIER,
  allUseSites,
  classify,
} from './border-tier-non-border-uses.test.ts';

const PACKAGE_ROOT = join(import.meta.dirname, '..', '..');

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function recordAliases(
  node: Record<string, unknown>,
  path: readonly string[],
  document: string,
  unclassified: string[],
): void {
  const extensions = isRecord(node['$extensions']) ? node['$extensions'] : undefined;
  const cinder = extensions?.['com.lostgradient.cinder'];
  const cinderExtensions = isRecord(cinder) ? cinder : undefined;
  for (const candidate of [cinderExtensions?.['cssRecipe'], node['$value']]) {
    if (typeof candidate !== 'string' || !CORPUS_TIER.test(candidate)) continue;
    const name = path.join('.');
    if (CORPUS_ALIASES[name] === undefined) unclassified.push(`${document}  ${name}`);
  }
}

function collectAliases(
  node: unknown,
  path: readonly string[],
  document: string,
  unclassified: string[],
): void {
  if (!isRecord(node)) return;
  recordAliases(node, path, document, unclassified);
  for (const [key, child] of Object.entries(node)) {
    if (key.startsWith('$')) continue;
    collectAliases(child, [...path, key], document, unclassified);
  }
}

describe('CIN-245: structural border tier corpus audit', () => {
  test('every corpus alias into a tier is classified', () => {
    const unclassified: string[] = [];
    for (const document of CORPUS_DOCUMENTS) {
      const parsed: unknown = JSON.parse(readFileSync(join(PACKAGE_ROOT, document), 'utf8'));
      collectAliases(parsed, [], document, unclassified);
    }
    expect(
      [...new Set(unclassified)],
      'A corpus token aliases a structural tier. It reaches the page through the generated ' +
        'stylesheet, so no hand-authored file mentions it and the scan above cannot see it. ' +
        'Classify it here, and if it is an area fill, record it in the seam audit.',
    ).toEqual([]);
  });
  test('every area fill is named in the seam audit', () => {
    const audit = readFileSync(
      join(PACKAGE_ROOT, 'documentation/css-audit/translucent-border-seams.md'),
      'utf8',
    );
    const missing = new Set<string>();
    for (const [file, declaration] of allUseSites()) {
      const entry = classify(file, declaration);
      if (entry?.category !== 'area') continue;
      const name = entry.audit ?? file;
      if (!audit.includes(name)) missing.add(name);
    }
    for (const entry of Object.values(CORPUS_ALIASES)) {
      if (entry.category !== 'area') continue;
      const name = entry.audit ?? entry.declaration;
      if (!audit.includes(name)) missing.add(name);
    }
    expect(
      [...missing],
      'An area fill carries the tier alpha over a real surface, so the audit has to name it ' +
        'and record its measured contrast.',
    ).toEqual([]);
  });
});
