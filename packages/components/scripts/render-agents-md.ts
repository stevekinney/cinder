/**
 * Renders the overlap-family decision-aid block inside
 * `packages/components/AGENTS.md`. The block is bracketed by:
 *
 *     <!-- generated:overlap-families:start -->
 *     ...
 *     <!-- generated:overlap-families:end -->
 *
 * Content outside the markers is preserved verbatim. The generator pulls each
 * family's roster from `manifest.meta.ts#overlapFamilies` (via the generated
 * `components.json`) and renders a one-line `purpose` plus the first `useWhen`
 * entry per member as a quick decision aid.
 *
 * Usage:
 *   bun run scripts/render-agents-md.ts          # write
 *   bun run scripts/render-agents-md.ts --check  # exit 1 on drift
 */

import { file, write } from 'bun';
import { resolve } from 'node:path';
import * as prettier from 'prettier';
import { assertPrettierResolvesToRoot } from './lib/prettier-resolution.ts';
import { readJsonFile } from './lib/read-json-file.ts';

const PACKAGE_ROOT = resolve(import.meta.dir, '..');
const MANIFEST_PATH = resolve(PACKAGE_ROOT, 'components.json');
const AGENTS_PATH = resolve(PACKAGE_ROOT, 'AGENTS.md');

const START_MARKER = '<!-- generated:overlap-families:start -->';
const END_MARKER = '<!-- generated:overlap-families:end -->';

export type ComponentEntry = {
  id: string;
  name: string;
  purpose: string;
  useWhen?: readonly string[];
  avoidWhen?: readonly { reason: string; alternative?: string }[];
};

export type Manifest = {
  overlapFamilies: Record<string, readonly string[]>;
  components: readonly ComponentEntry[];
};

/** Escape pipe characters that would otherwise break a Markdown table cell. */
export function escapeCell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\n+/g, ' ');
}

/** Truncate at a sentence boundary or hard cap so the table stays readable. */
export function shorten(text: string, max = 110): string {
  if (text.length <= max) return text;
  const slice = text.slice(0, max);
  const lastSpace = slice.lastIndexOf(' ');
  return `${slice.slice(0, lastSpace > 40 ? lastSpace : max)}…`;
}

function renderFamilyTable(
  family: string,
  memberIds: readonly string[],
  byId: Map<string, ComponentEntry>,
): string {
  const rows: string[] = [];
  rows.push(`### ${family} (${memberIds.length} components)`);
  rows.push('');
  rows.push('| id | purpose | use when |');
  rows.push('| --- | --- | --- |');
  for (const id of memberIds) {
    const entry = byId.get(id);
    if (!entry) {
      throw new Error(
        `Overlap family "${family}" references unknown component id "${id}". ` +
          `Regenerate components.json or fix manifest.meta.ts#overlapFamilies.`,
      );
    }
    const purpose = escapeCell(shorten(entry.purpose));
    const useWhenFirst = entry.useWhen?.[0] ?? '';
    const useWhen = escapeCell(shorten(useWhenFirst));
    rows.push(`| \`${entry.id}\` | ${purpose} | ${useWhen} |`);
  }
  return rows.join('\n');
}

export function renderOverlapBlock(manifest: Manifest): string {
  const byId = new Map(manifest.components.map((component) => [component.id, component]));
  const familyNames = Object.keys(manifest.overlapFamilies).toSorted();
  const sections = familyNames.map((family) => {
    const members = manifest.overlapFamilies[family];
    if (!members) {
      throw new Error(`overlapFamilies key "${family}" disappeared between enumeration and lookup`);
    }
    return renderFamilyTable(family, members, byId);
  });
  return sections.join('\n\n');
}

export function replaceBlock(source: string, body: string): string {
  const startIndex = source.indexOf(START_MARKER);
  const endIndex = source.indexOf(END_MARKER);
  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    throw new Error(
      `Could not find generated markers in ${AGENTS_PATH}. ` +
        `Expected both "${START_MARKER}" and "${END_MARKER}".`,
    );
  }
  const before = source.slice(0, startIndex + START_MARKER.length);
  const after = source.slice(endIndex);
  return `${before}\n\n${body}\n\n${after}`;
}

export type OverlapRow = { purpose: string; useWhen: string };

/**
 * Parse `| \`id\` | purpose | use when |` rows out of a generated
 * overlap-family block, grouped by the `### {family} (…)` header each
 * table sits under.
 *
 * Family-scoped (rather than a flat `id -> row` map) because a component can
 * belong to more than one overlap family — e.g. `segmented-control` is in
 * both `selection` and `tabs` — so a row dropped from ONE family's table
 * must not be masked by a same-id row still present in another family's
 * table.
 */
export function parseGeneratedRows(block: string): Map<string, Map<string, OverlapRow>> {
  const familyHeaderPattern = /^### ([a-z][a-z0-9-]*) \(\d+ components\)\s*$/gm;
  // Negative lookbehind on each `|` separator so an escaped pipe inside a
  // cell (`escapeCell` emits `\|`) isn't mistaken for a column boundary.
  const rowPattern = /^\|\s*`([a-z0-9-]+)`\s*(?<!\\)\|(.+?)(?<!\\)\|(.+?)(?<!\\)\|\s*$/gm;

  const headers = [...block.matchAll(familyHeaderPattern)].map((match) => ({
    family: match[1]!,
    start: match.index,
  }));

  const families = new Map<string, Map<string, OverlapRow>>();
  for (const [index, header] of headers.entries()) {
    const end = headers[index + 1]?.start ?? block.length;
    const segment = block.slice(header.start, end);
    const rows = new Map<string, OverlapRow>();
    for (const match of segment.matchAll(rowPattern)) {
      const [, id, purpose, useWhen] = match;
      if (!id || purpose === undefined || useWhen === undefined) continue;
      rows.set(id, { purpose: purpose.trim(), useWhen: useWhen.trim() });
    }
    families.set(header.family, rows);
  }
  return families;
}

/**
 * Compare the AGENTS.md overlap-family block against the manifest and return
 * a list of human-readable mismatches (empty when the block is up to date).
 *
 * Compared PER `(family, id)` pair, not per id, for the same reason
 * {@link parseGeneratedRows} groups by family: a component in more than one
 * overlap family must have a correct row in EVERY family's table.
 *
 * Deliberately independent of Prettier (unlike the full CLI `--check`): the
 * `browser` export condition `bun test` resolves doesn't expose Prettier's
 * `resolveConfig`/`format`, so this content comparison — not a byte-for-byte
 * reformat diff — is what can run inside `bun:test` and, from there, inside
 * `components:check` regardless of test scoping.
 */
export function findOverlapFamilyDrift(manifest: Manifest, agentsMd: string): string[] {
  const start = agentsMd.indexOf(START_MARKER);
  const end = agentsMd.indexOf(END_MARKER);
  if (start === -1 || end === -1) {
    return [`Could not find generated markers ("${START_MARKER}"/"${END_MARKER}") in AGENTS.md`];
  }

  const byId = new Map(manifest.components.map((component) => [component.id, component]));
  const families = parseGeneratedRows(agentsMd.slice(start, end));

  const mismatches: string[] = [];
  for (const [family, memberIds] of Object.entries(manifest.overlapFamilies)) {
    const rows = families.get(family);
    for (const id of memberIds) {
      const entry = byId.get(id);
      const row = rows?.get(id);
      if (!entry || !row) {
        mismatches.push(
          `"${family}/${id}" is missing from ${entry ? 'AGENTS.md' : 'components.json'}`,
        );
        continue;
      }
      const expectedPurpose = escapeCell(shorten(entry.purpose));
      const expectedUseWhen = escapeCell(shorten(entry.useWhen?.[0] ?? ''));
      if (row.purpose !== expectedPurpose) {
        mismatches.push(
          `"${family}/${id}" purpose: AGENTS.md has "${row.purpose}", manifest has "${expectedPurpose}"`,
        );
      }
      if (row.useWhen !== expectedUseWhen) {
        mismatches.push(
          `"${family}/${id}" useWhen: AGENTS.md has "${row.useWhen}", manifest has "${expectedUseWhen}"`,
        );
      }
    }
  }

  for (const [family, rows] of families) {
    const expectedIds = new Set(manifest.overlapFamilies[family] ?? []);
    for (const id of rows.keys()) {
      if (!expectedIds.has(id)) {
        mismatches.push(
          `"${family}/${id}" is a stale row in AGENTS.md — no longer in overlap family "${family}"`,
        );
      }
    }
  }

  return mismatches;
}

async function main(): Promise<void> {
  const check = process.argv.includes('--check');

  const manifest = await readJsonFile<Manifest>(MANIFEST_PATH);
  const existing = await file(AGENTS_PATH).text();
  const body = renderOverlapBlock(manifest);
  const rendered = replaceBlock(existing, body);
  // Format with Prettier so the generated tables match the repository-wide
  // markdown style and `bun run format:check` stays green after a regenerate.
  assertPrettierResolvesToRoot();
  const prettierConfig = (await prettier.resolveConfig(AGENTS_PATH)) ?? {};
  const next = await prettier.format(rendered, { ...prettierConfig, filepath: AGENTS_PATH });

  if (check) {
    if (next !== existing) {
      console.error(
        `AGENTS.md is out of date. Run \`bun run scripts/render-agents-md.ts\` to refresh ` +
          `the overlap-family decision aid.`,
      );
      process.exit(1);
    }
    console.log('AGENTS.md overlap-family block is up to date.');
    return;
  }

  if (next === existing) {
    console.log('AGENTS.md already up to date — no changes written.');
    return;
  }
  await write(AGENTS_PATH, next);
  console.log(`Wrote overlap-family block to ${AGENTS_PATH}.`);
}

if (import.meta.main) {
  await main();
}
