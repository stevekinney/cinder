/**
 * Unit and drift tests for the AGENTS.md overlap-family decision-aid
 * generator.
 *
 * The unit tests exercise the pure rendering functions against inline
 * fixtures. The drift test parses the `| \`id\` | purpose | use when |` rows
 * out of the generated block in the real `AGENTS.md` and asserts each
 * overlap-family member's purpose and first `useWhen` match the real
 * `components.json` manifest — the invariant that matters, without
 * depending on Prettier's formatting (see `parseGeneratedRows` below). It is
 * what would have caught a manifest edit (a component's
 * `@purpose`/`@useWhen` JSDoc) that never made it into the generated table.
 */

import { file } from 'bun';
import { resolve } from 'node:path';

import { describe, expect, it } from 'bun:test';

import { readJsonFile } from './lib/read-json-file.ts';
import {
  type ComponentEntry,
  type Manifest,
  escapeCell,
  renderOverlapBlock,
  replaceBlock,
  shorten,
} from './render-agents-md.ts';

const PACKAGE_ROOT = resolve(import.meta.dir, '..');
const MANIFEST_PATH = resolve(PACKAGE_ROOT, 'components.json');
const AGENTS_PATH = resolve(PACKAGE_ROOT, 'AGENTS.md');
const START_MARKER = '<!-- generated:overlap-families:start -->';
const END_MARKER = '<!-- generated:overlap-families:end -->';

/**
 * Parse `| \`id\` | purpose | use when |` rows out of the generated block.
 *
 * This mirrors `renderFamilyTable`'s row shape without depending on
 * `prettier` for byte-for-byte comparison: `bun run test` resolves the
 * `browser` export condition, under which `prettier`'s browser build (
 * `standalone.mjs`) doesn't expose `resolveConfig`/`format` the way the CLI
 * script (run directly via `bun run scripts/render-agents-md.ts`) does. The
 * invariant this test protects — table text matches the manifest — doesn't
 * depend on Prettier's column padding, so we compare trimmed cell content
 * instead of reformatted output.
 */
function parseGeneratedRows(agentsMd: string): Map<string, { purpose: string; useWhen: string }> {
  const start = agentsMd.indexOf(START_MARKER);
  const end = agentsMd.indexOf(END_MARKER);
  if (start === -1 || end === -1) {
    throw new Error(`Could not find generated markers in ${AGENTS_PATH}.`);
  }
  const block = agentsMd.slice(start, end);

  const rows = new Map<string, { purpose: string; useWhen: string }>();
  // Negative lookbehind on each `|` separator so an escaped pipe inside a
  // cell (`escapeCell` emits `\|`) isn't mistaken for a column boundary.
  const rowPattern = /^\|\s*`([a-z0-9-]+)`\s*(?<!\\)\|(.+?)(?<!\\)\|(.+?)(?<!\\)\|\s*$/gm;
  for (const match of block.matchAll(rowPattern)) {
    const [, id, purpose, useWhen] = match;
    if (!id || purpose === undefined || useWhen === undefined) continue;
    rows.set(id, { purpose: purpose.trim(), useWhen: useWhen.trim() });
  }
  return rows;
}

function makeEntry(overrides: Partial<ComponentEntry> & { id: string }): ComponentEntry {
  return {
    name: overrides.id,
    purpose: 'Placeholder purpose.',
    useWhen: ['Placeholder use when.'],
    ...overrides,
  };
}

describe('renderOverlapBlock', () => {
  it('renders one table per family, sorted alphabetically by family name', () => {
    const manifest: Manifest = {
      overlapFamilies: {
        zeta: ['b'],
        alpha: ['a'],
      },
      components: [
        makeEntry({ id: 'a', purpose: 'Purpose A.', useWhen: ['Use A first.', 'Use A second.'] }),
        makeEntry({ id: 'b', purpose: 'Purpose B.', useWhen: ['Use B first.'] }),
      ],
    };

    const block = renderOverlapBlock(manifest);
    const alphaIndex = block.indexOf('### alpha');
    const zetaIndex = block.indexOf('### zeta');

    expect(alphaIndex).toBeGreaterThanOrEqual(0);
    expect(zetaIndex).toBeGreaterThan(alphaIndex);
  });

  it('renders the purpose and only the first useWhen entry per row', () => {
    const manifest: Manifest = {
      overlapFamilies: { chronological: ['feed'] },
      components: [
        makeEntry({
          id: 'feed',
          purpose: 'Ordered list container for a chronological stream.',
          useWhen: ['Rendering a user-facing activity stream.', 'A second clause never shown.'],
        }),
      ],
    };

    const block = renderOverlapBlock(manifest);

    expect(block).toContain('Ordered list container for a chronological stream.');
    expect(block).toContain('Rendering a user-facing activity stream.');
    expect(block).not.toContain('A second clause never shown.');
  });

  it('reflects an updated useWhen the next time it is regenerated', () => {
    const stale: Manifest = {
      overlapFamilies: { chronological: ['feed'] },
      components: [
        makeEntry({
          id: 'feed',
          purpose: 'Ordered list container for a chronological stream.',
          useWhen: ['Rendering an activity log, audit trail, or notification timeline.'],
        }),
      ],
    };
    const updated: Manifest = {
      overlapFamilies: { chronological: ['feed'] },
      components: [
        makeEntry({
          id: 'feed',
          purpose: 'Ordered list container for a chronological stream.',
          useWhen: ['Rendering a user-facing activity stream or notification timeline.'],
        }),
      ],
    };

    expect(renderOverlapBlock(stale)).not.toEqual(renderOverlapBlock(updated));
    expect(renderOverlapBlock(updated)).toContain(
      'Rendering a user-facing activity stream or notification timeline.',
    );
  });

  it('throws when a family references a component id missing from the manifest', () => {
    const manifest: Manifest = {
      overlapFamilies: { chronological: ['ghost'] },
      components: [],
    };

    expect(() => renderOverlapBlock(manifest)).toThrow(/unknown component id "ghost"/);
  });
});

describe('replaceBlock', () => {
  it('replaces only the content between the generated markers', () => {
    const source = [
      '# AGENTS',
      '',
      'Preface text.',
      '',
      '<!-- generated:overlap-families:start -->',
      'stale content',
      '<!-- generated:overlap-families:end -->',
      '',
      'Trailing text.',
      '',
    ].join('\n');

    const next = replaceBlock(source, 'fresh content');

    expect(next).toContain('Preface text.');
    expect(next).toContain('Trailing text.');
    expect(next).toContain('fresh content');
    expect(next).not.toContain('stale content');
  });

  it('throws when either marker is missing', () => {
    expect(() => replaceBlock('no markers here', 'body')).toThrow(
      /Could not find generated markers/,
    );
  });
});

describe('AGENTS.md overlap-family drift', () => {
  it('documents the same purpose and first useWhen as components.json for every overlap-family member', async () => {
    const [manifest, existing] = await Promise.all([
      readJsonFile<Manifest>(MANIFEST_PATH),
      file(AGENTS_PATH).text(),
    ]);

    const byId = new Map(manifest.components.map((component) => [component.id, component]));
    const documentedIds = new Set(Object.values(manifest.overlapFamilies).flat());
    const rows = parseGeneratedRows(existing);

    // Sanity floor: a parser regression that silently returns an empty map
    // would otherwise show up as a confusing "0 mismatches" false pass.
    expect(rows.size).toBeGreaterThan(0);

    const mismatches: string[] = [];
    for (const id of documentedIds) {
      const entry = byId.get(id);
      const row = rows.get(id);
      if (!entry || !row) {
        mismatches.push(`"${id}" is missing from ${entry ? 'AGENTS.md' : 'components.json'}`);
        continue;
      }
      const expectedPurpose = escapeCell(shorten(entry.purpose));
      const expectedUseWhen = escapeCell(shorten(entry.useWhen?.[0] ?? ''));
      if (row.purpose !== expectedPurpose) {
        mismatches.push(
          `"${id}" purpose: AGENTS.md has "${row.purpose}", manifest has "${expectedPurpose}"`,
        );
      }
      if (row.useWhen !== expectedUseWhen) {
        mismatches.push(
          `"${id}" useWhen: AGENTS.md has "${row.useWhen}", manifest has "${expectedUseWhen}"`,
        );
      }
    }
    for (const id of rows.keys()) {
      if (!documentedIds.has(id)) {
        mismatches.push(`"${id}" is a stale row in AGENTS.md — no longer in any overlap family`);
      }
    }

    expect(mismatches).toEqual([]);
  });
});
