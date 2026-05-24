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
import prettier from 'prettier';

const PACKAGE_ROOT = resolve(import.meta.dir, '..');
const MANIFEST_PATH = resolve(PACKAGE_ROOT, 'components.json');
const AGENTS_PATH = resolve(PACKAGE_ROOT, 'AGENTS.md');

const START_MARKER = '<!-- generated:overlap-families:start -->';
const END_MARKER = '<!-- generated:overlap-families:end -->';

type ComponentEntry = {
  id: string;
  name: string;
  purpose: string;
  useWhen?: readonly string[];
  avoidWhen?: readonly string[];
};

type Manifest = {
  overlapFamilies: Record<string, readonly string[]>;
  components: readonly ComponentEntry[];
};

/** Escape pipe characters that would otherwise break a Markdown table cell. */
function escapeCell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\n+/g, ' ');
}

/** Truncate at a sentence boundary or hard cap so the table stays readable. */
function shorten(text: string, max = 110): string {
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

function renderOverlapBlock(manifest: Manifest): string {
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

function replaceBlock(source: string, body: string): string {
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

async function main(): Promise<void> {
  const check = process.argv.includes('--check');

  const manifest = (await file(MANIFEST_PATH).json()) as Manifest;
  const existing = await file(AGENTS_PATH).text();
  const body = renderOverlapBlock(manifest);
  const rendered = replaceBlock(existing, body);
  // Format with Prettier so the generated tables match the repository-wide
  // markdown style and `bun run format:check` stays green after a regenerate.
  const prettierConfig = (await prettier.resolveConfig(AGENTS_PATH)) ?? {};
  const next = await prettier.format(rendered, { ...prettierConfig, filepath: AGENTS_PATH });

  if (check) {
    if (next !== existing) {
      console.error(
        `AGENTS.md is out of date. Run \`bun run agents:generate\` to refresh ` +
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

await main();
