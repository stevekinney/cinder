import { afterEach, describe, expect, it } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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

// Track every temp tree so it's removed after each test — otherwise repeated
// local + CI runs leak fixture directories into the system temp dir.
const fixtureRoots: string[] = [];
afterEach(() => {
  while (fixtureRoots.length > 0) {
    rmSync(fixtureRoots.pop()!, { recursive: true, force: true });
  }
});

/**
 * Build a throwaway component tree on disk: a `components/` directory with one
 * `<name>/<name>.css` per entry, plus a `styles/components.css` aggregator. Each
 * `aggregatorImports` entry is emitted as `@import '<specifier>';` (quoted bare
 * form). Extra raw files can be dropped in per component to model sub-component
 * partials, nested partials, and JS-only imports. Tests that need a non-standard
 * aggregator (a commented-out or `url(...)`-wrapped import) write the
 * `components.css` themselves rather than going through `aggregatorImports`.
 */
function makeFixture(options: {
  components: string[];
  aggregatorImports: string[];
  extraFiles?: Array<{ path: string; content: string }>;
}): { componentsDirectory: string; aggregatorFile: string } {
  const root = mkdtempSync(join(tmpdir(), 'aggregator-gate-'));
  fixtureRoots.push(root);
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

  // The parser must NOT count a commented-out @import as coverage. A regex would
  // treat `/* @import '…'; */` as real and let an unstyled component pass the
  // gate — the exact false-pass this gate exists to prevent. postcss parses it
  // as a comment node, so the closure never reaches it.
  it('does NOT count a commented-out @import as coverage', () => {
    const root = mkdtempSync(join(tmpdir(), 'aggregator-gate-'));
    fixtureRoots.push(root);
    const stylesDirectory = join(root, 'styles');
    mkdirSync(stylesDirectory, { recursive: true });
    const componentsDirectory = join(root, 'components');
    mkdirSync(join(componentsDirectory, 'beta'), { recursive: true });
    writeFileSync(join(componentsDirectory, 'beta', 'beta.css'), '.cinder-beta {}\n');
    const aggregatorFile = join(stylesDirectory, 'components.css');
    writeFileSync(aggregatorFile, `/* @import '../components/beta/beta.css'; */\n`);

    const reachable = computeImportClosure(aggregatorFile);
    expect(reachable.has(join(componentsDirectory, 'beta', 'beta.css'))).toBe(false);
  });

  it('follows the unquoted and quoted url(...) @import forms', () => {
    const { componentsDirectory, aggregatorFile } = makeFixture({
      components: ['alpha', 'beta', 'gamma'],
      aggregatorImports: ['../components/alpha/alpha.css'],
      extraFiles: [
        {
          path: 'alpha/alpha.css',
          content:
            `@import url(../beta/beta.css);\n` +
            `@import url('../gamma/gamma.css');\n` +
            `.cinder-alpha {}\n`,
        },
      ],
    });

    const reachable = computeImportClosure(aggregatorFile);
    expect(reachable.has(join(componentsDirectory, 'beta/beta.css'))).toBe(true);
    expect(reachable.has(join(componentsDirectory, 'gamma/gamma.css'))).toBe(true);
  });

  it('follows an @import with a trailing layer()/media clause', () => {
    const { componentsDirectory, aggregatorFile } = makeFixture({
      components: ['alpha', 'beta'],
      aggregatorImports: ['../components/alpha/alpha.css'],
      extraFiles: [
        {
          path: 'alpha/alpha.css',
          content: `@import '../beta/beta.css' layer(cinder.components);\n.cinder-alpha {}\n`,
        },
      ],
    });

    const reachable = computeImportClosure(aggregatorFile);
    expect(reachable.has(join(componentsDirectory, 'beta/beta.css'))).toBe(true);
  });

  it('terminates on an import cycle', () => {
    const { componentsDirectory, aggregatorFile } = makeFixture({
      components: ['alpha', 'beta'],
      aggregatorImports: ['../components/alpha/alpha.css'],
      extraFiles: [
        // alpha -> beta -> alpha. The `reachable` set must break the cycle.
        { path: 'alpha/alpha.css', content: `@import '../beta/beta.css';\n.cinder-alpha {}\n` },
        { path: 'beta/beta.css', content: `@import '../alpha/alpha.css';\n.cinder-beta {}\n` },
      ],
    });

    const reachable = computeImportClosure(aggregatorFile);
    expect(reachable.has(join(componentsDirectory, 'alpha/alpha.css'))).toBe(true);
    expect(reachable.has(join(componentsDirectory, 'beta/beta.css'))).toBe(true);
  });

  // CSS only honors @import at the top level of the stylesheet prelude. An import
  // nested inside @media (or @supports) is NOT applied by the bundle, so counting
  // it would be a false-pass — exactly what walkAtRules() would have done.
  it('does NOT follow an @import nested inside @media', () => {
    const { componentsDirectory, aggregatorFile } = makeFixture({
      components: ['alpha', 'beta'],
      aggregatorImports: ['../components/alpha/alpha.css'],
      extraFiles: [
        {
          path: 'alpha/alpha.css',
          content: `@media (min-width: 1px) {\n  @import '../beta/beta.css';\n}\n.cinder-alpha {}\n`,
        },
      ],
    });

    const reachable = computeImportClosure(aggregatorFile);
    expect(reachable.has(join(componentsDirectory, 'beta/beta.css'))).toBe(false);
  });

  // A @import that appears AFTER a style rule is past the prelude and is ignored
  // by the bundle — it must not count as coverage.
  it('does NOT follow a late @import after a style rule', () => {
    const { componentsDirectory, aggregatorFile } = makeFixture({
      components: ['alpha', 'beta'],
      aggregatorImports: ['../components/alpha/alpha.css'],
      extraFiles: [
        {
          path: 'alpha/alpha.css',
          content: `.cinder-alpha {}\n@import '../beta/beta.css';\n`,
        },
      ],
    });

    const reachable = computeImportClosure(aggregatorFile);
    expect(reachable.has(join(componentsDirectory, 'beta/beta.css'))).toBe(false);
  });

  // The real cinder partials open with a `@layer …;` statement prelude before
  // their sibling-leaf @import (e.g. command-menu.css). That statement must NOT
  // end the prelude, so the @import after it is still honored.
  it('honors an @import that follows a leading @layer statement', () => {
    const { componentsDirectory, aggregatorFile } = makeFixture({
      components: ['alpha', 'beta'],
      aggregatorImports: ['../components/alpha/alpha.css'],
      extraFiles: [
        {
          path: 'alpha/alpha.css',
          content:
            `@layer cinder.tokens, cinder.components;\n` +
            `@import '../beta/beta.css';\n` +
            `@layer cinder.components {\n  .cinder-alpha {}\n}\n`,
        },
      ],
    });

    const reachable = computeImportClosure(aggregatorFile);
    expect(reachable.has(join(componentsDirectory, 'beta/beta.css'))).toBe(true);
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

    // Exactly the unstyled file is flagged — and nothing else (e.g. alpha,
    // which IS covered, must not appear).
    const violations = checkAggregatorCompleteness(componentsDirectory, aggregatorFile);
    expect(violations.map((violation) => violation.path)).toEqual(['data-table/data-table.css']);
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
  });

  it('flags a DEEPER nested partial that is not in the @import chain', () => {
    const { componentsDirectory, aggregatorFile } = makeFixture({
      components: ['alpha'],
      aggregatorImports: ['../components/alpha/alpha.css'],
      extraFiles: [
        // A second, deeper CSS file under the component dir, NOT @imported by
        // alpha.css — it would ship unstyled and must be caught (the `**/*.css`
        // scan, not `*/*.css`, is what makes this visible).
        { path: 'alpha/internal/extra.css', content: '.cinder-alpha-extra {}\n' },
      ],
    });

    const violations = checkAggregatorCompleteness(componentsDirectory, aggregatorFile);
    // Reported with forward slashes (a multi-segment path), never backslashes —
    // so the value is stable across platforms and matches the POSIX-keyed
    // exclusion list on Windows too.
    expect(violations.map((violation) => violation.path)).toEqual(['alpha/internal/extra.css']);
    expect(violations[0]?.path).not.toContain('\\');
  });

  it('treats a second component CSS file as covered when the first @imports it', () => {
    const { componentsDirectory, aggregatorFile } = makeFixture({
      components: ['alpha'],
      aggregatorImports: ['../components/alpha/alpha.css'],
      extraFiles: [
        // alpha.css pulls in a sibling partial in the same dir — covered.
        { path: 'alpha/alpha.css', content: `@import './alpha-extra.css';\n.cinder-alpha {}\n` },
        { path: 'alpha/alpha-extra.css', content: '.cinder-alpha-extra {}\n' },
      ],
    });

    expect(checkAggregatorCompleteness(componentsDirectory, aggregatorFile)).toEqual([]);
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
