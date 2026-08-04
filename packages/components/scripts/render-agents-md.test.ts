/**
 * Unit and drift tests for the AGENTS.md overlap-family decision-aid
 * generator.
 *
 * The unit tests exercise the pure rendering functions against inline
 * fixtures. The drift test uses `findOverlapFamilyDrift` (see
 * `render-agents-md.ts`) to compare the generated block in the real
 * `AGENTS.md` against the real `components.json` manifest, per
 * `(family, id)` pair rather than by id alone — the invariant that matters,
 * without depending on Prettier's formatting. It is what would have caught a
 * manifest edit (a component's `@purpose`/`@useWhen` JSDoc) that never made
 * it into the generated table, including a dropped row for a component that
 * belongs to more than one overlap family.
 */

import { file } from 'bun';
import { resolve } from 'node:path';

import { describe, expect, it } from 'bun:test';

import { readJsonFile } from './lib/read-json-file.ts';
import {
  type ComponentEntry,
  type Manifest,
  findOverlapFamilyDrift,
  parseGeneratedRows,
  renderOverlapBlock,
  replaceBlock,
} from './render-agents-md.ts';

const PACKAGE_ROOT = resolve(import.meta.dir, '..');
const MANIFEST_PATH = resolve(PACKAGE_ROOT, 'components.json');
const AGENTS_PATH = resolve(PACKAGE_ROOT, 'AGENTS.md');
const START_MARKER = '<!-- generated:overlap-families:start -->';
const END_MARKER = '<!-- generated:overlap-families:end -->';

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

    // Sanity floor: a parser regression that silently returns no family
    // sections would otherwise show up as a confusing "0 mismatches" false
    // pass, since `findOverlapFamilyDrift` has nothing to compare against.
    const start = existing.indexOf(START_MARKER);
    const end = existing.indexOf(END_MARKER);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const families = parseGeneratedRows(existing.slice(start, end));
    expect(new Set(families.keys())).toEqual(new Set(Object.keys(manifest.overlapFamilies)));

    expect(findOverlapFamilyDrift(manifest, existing)).toEqual([]);
  });

  it('catches a row dropped from only one family when the component belongs to two', () => {
    // Regression for a component appearing in more than one overlap family
    // (real example: `segmented-control` is in both `selection` and `tabs`).
    // A flat `id -> row` map would resolve the id via the surviving family's
    // row and miss that the OTHER family's row is gone; this must not.
    const manifest: Manifest = {
      overlapFamilies: {
        selection: ['segmented-control'],
        tabs: ['segmented-control'],
      },
      components: [
        makeEntry({
          id: 'segmented-control',
          purpose: 'Purpose.',
          useWhen: ['Use it.'],
        }),
      ],
    };
    const wrap = (block: string) => [START_MARKER, block, END_MARKER].join('\n');
    const completeBlock = renderOverlapBlock(manifest);
    const droppedTabsRowBlock = [
      '### selection (1 components)',
      '',
      '| id | purpose | use when |',
      '| --- | --- | --- |',
      '| `segmented-control` | Purpose. | Use it. |',
      '',
      '### tabs (1 components)',
      '',
      '| id | purpose | use when |',
      '| --- | --- | --- |',
    ].join('\n');

    expect(findOverlapFamilyDrift(manifest, wrap(completeBlock))).toEqual([]);
    expect(findOverlapFamilyDrift(manifest, wrap(droppedTabsRowBlock))).not.toEqual([]);
  });
});
