import { describe, expect, it } from 'bun:test';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  AGGREGATOR_EXCLUSIONS,
  checkAggregatorCompleteness,
  computeImportClosure,
} from './check-aggregator-completeness.ts';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const componentsRoot = resolve(scriptDirectory, '..');
const componentsSource = join(componentsRoot, 'src');
const realComponentsDirectory = join(componentsSource, 'components');
const realAggregator = join(componentsSource, 'styles', 'components.css');

/**
 * Build a throwaway component tree on disk: a `components/` directory with one
 * `<name>/<name>.css` per entry, plus a `styles/components.css` aggregator that
 * imports the given names. Extra raw files can be dropped in per component to
 * model sub-component partials and JS-only imports.
 */
function makeFixture(options: {
  components: string[];
  aggregatorImports: string[];
  extraFiles?: Array<{ path: string; content: string }>;
}): { componentsDirectory: string; aggregatorFile: string } {
  const root = mkdtempSync(join(tmpdir(), 'aggregator-gate-'));
  const componentsDirectory = join(root, 'components');
  const stylesDirectory = join(root, 'styles');
  mkdirSync(stylesDirectory, { recursive: true });

  for (const name of options.components) {
    const dir = join(componentsDirectory, name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${name}.css`), `.cinder-${name} { color: red; }\n`);
  }

  for (const file of options.extraFiles ?? []) {
    const absolute = join(componentsDirectory, file.path);
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, file.content);
  }

  const importLines = options.aggregatorImports
    .map((specifier) => `@import '${specifier}';`)
    .join('\n');
  writeFileSync(join(stylesDirectory, 'components.css'), `${importLines}\n`);

  return {
    componentsDirectory,
    aggregatorFile: join(stylesDirectory, 'components.css'),
  };
}

describe('computeImportClosure', () => {
  it('follows transitive relative @import chains', () => {
    const { componentsDirectory, aggregatorFile } = makeFixture({
      components: ['alpha', 'beta'],
      // aggregator imports alpha; alpha imports beta — beta is transitively reachable.
      aggregatorImports: ['../components/alpha/alpha.css'],
      extraFiles: [
        {
          path: 'alpha/alpha.css',
          content: `@import '../beta/beta.css';\n.cinder-alpha { color: red; }\n`,
        },
      ],
    });

    const reachable = computeImportClosure(aggregatorFile);
    expect(reachable.has(join(componentsDirectory, 'alpha/alpha.css'))).toBe(true);
    expect(reachable.has(join(componentsDirectory, 'beta/beta.css'))).toBe(true);
  });

  it('does not follow bare-specifier (package) imports', () => {
    const { componentsDirectory, aggregatorFile } = makeFixture({
      components: ['alpha'],
      aggregatorImports: ['../components/alpha/alpha.css'],
      extraFiles: [
        {
          path: 'alpha/alpha.css',
          // A bare specifier is not an on-disk relative path — must not be chased.
          content: `@import 'some-package/styles.css';\n.cinder-alpha {}\n`,
        },
      ],
    });

    const reachable = computeImportClosure(aggregatorFile);
    expect(reachable.has(join(componentsDirectory, 'alpha/alpha.css'))).toBe(true);
    // Nothing outside the relative graph leaked in.
    expect([...reachable].some((file) => file.includes('some-package'))).toBe(false);
  });
});

describe('checkAggregatorCompleteness', () => {
  it('passes when every component CSS is reachable from the aggregator', () => {
    const { componentsDirectory, aggregatorFile } = makeFixture({
      components: ['alpha', 'beta'],
      aggregatorImports: ['../components/alpha/alpha.css', '../components/beta/beta.css'],
    });

    expect(checkAggregatorCompleteness(componentsDirectory, aggregatorFile)).toEqual([]);
  });

  it('flags a component missing from the aggregator', () => {
    const { componentsDirectory, aggregatorFile } = makeFixture({
      components: ['alpha', 'beta'],
      // beta is omitted from the aggregator — it ships unstyled to /styles.
      aggregatorImports: ['../components/alpha/alpha.css'],
    });

    const violations = checkAggregatorCompleteness(componentsDirectory, aggregatorFile);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.path).toBe('beta/beta.css');
    expect(violations[0]?.message).toContain('UNSTYLED');
  });

  // The defining regression: the DataTable bug had data-table/index.ts doing
  // `import './data-table.css'` yet was still missing from components.css and
  // shipped unstyled. A JS/index.ts import MUST NOT count as coverage, or the
  // gate would bless the exact bug it exists to catch.
  it('does NOT treat an index.ts JS import as aggregator coverage', () => {
    const { componentsDirectory, aggregatorFile } = makeFixture({
      components: ['alpha', 'data-table'],
      // Only alpha is in the aggregator. data-table is covered only by its
      // index.ts JS import (modeled below) — which the gate must ignore.
      aggregatorImports: ['../components/alpha/alpha.css'],
      extraFiles: [
        {
          path: 'data-table/index.ts',
          content: `import './data-table.css';\nexport { default as DataTable } from './data-table.svelte';\n`,
        },
      ],
    });

    const violations = checkAggregatorCompleteness(componentsDirectory, aggregatorFile);
    expect(violations.map((violation) => violation.path)).toContain('data-table/data-table.css');
  });

  it('treats a transitively-imported sub-component partial as covered', () => {
    const { componentsDirectory, aggregatorFile } = makeFixture({
      components: ['choice-grid', 'choice-grid-item'],
      // Only the parent is in the aggregator; it @imports the item partial.
      aggregatorImports: ['../components/choice-grid/choice-grid.css'],
      extraFiles: [
        {
          path: 'choice-grid/choice-grid.css',
          content: `@import '../choice-grid-item/choice-grid-item.css';\n.cinder-choice-grid {}\n`,
        },
      ],
    });

    // choice-grid-item.css is reachable via choice-grid.css — no violation.
    expect(checkAggregatorCompleteness(componentsDirectory, aggregatorFile)).toEqual([]);
    void componentsDirectory;
  });
});

describe('the real cinder aggregator', () => {
  it('imports every component CSS partial (or excludes it with a reason)', () => {
    const violations = checkAggregatorCompleteness(realComponentsDirectory, realAggregator);
    // A failure here lists each component CSS that would ship unstyled to
    // /styles consumers. Add the @import (alphabetical) or an exclusion entry.
    expect(violations).toEqual([]);
  });

  it('keeps every exclusion honest — each excluded file actually exists and is uncovered', () => {
    const reachable = computeImportClosure(realAggregator);
    for (const exclusion of AGGREGATOR_EXCLUSIONS) {
      const absolute = join(realComponentsDirectory, exclusion.path);
      // The file must exist (no stale exclusions) …
      expect(Bun.file(absolute).size).toBeGreaterThan(0);
      // … and must genuinely be outside the CSS chain (else the exclusion is
      // dead weight masking nothing).
      expect(reachable.has(absolute)).toBe(false);
      expect(exclusion.reason.length).toBeGreaterThan(0);
    }
  });
});
