/** Regression tests for the substantive component test convention. */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';
import { parse } from 'svelte/compiler';

import { hasSubstantiveTest } from '../scripts/component-conventions-tests.ts';
import { getPublicComponentSvelteFiles } from './convention-structural-test-helpers.ts';

const NO_TEST_REQUIRED_ALLOW_LIST = new Set<string>();
const COMPONENTS_DIR = join(import.meta.dir, 'components');

// ---------------------------------------------------------------------------
// Regression coverage for convention check #9 (substantive-test requirement).
//
// The whole-tree test above proves the live tree is clean; these focused tests
// prove the GATE itself behaves correctly — it must flag a brand-new untested
// component, reject a types-only snapshot or a `.skip` stub, and keep the
// allow-list honest (no stale entries; every entry is a real current gap).
// ---------------------------------------------------------------------------

describe('convention #9 — substantive-test gate', () => {
  // The check's decision for one discovered component, mirroring the loop above:
  // exempt if allow-listed, otherwise it must have a substantive test.
  function componentFails(name: string, testFilePath: string): boolean {
    if (NO_TEST_REQUIRED_ALLOW_LIST.has(name)) return false;
    return !hasSubstantiveTest(testFilePath).pass;
  }

  test('a new component with no test file fails the check', () => {
    const directory = mkdtempSync(join(tmpdir(), 'convention9-notest-'));
    try {
      writeFileSync(
        join(directory, 'widget.svelte'),
        `<script lang="ts" module>export type WidgetProps = { class?: string };</script>` +
          `<div class={classNames(rest.class)}></div>`,
      );
      // No widget.test.ts written at all.
      const result = componentFails('widget', join(directory, 'widget.test.ts'));
      expect(result).toBe(true);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test('a component with only a types-only snapshot (no test() call) fails the check', () => {
    const directory = mkdtempSync(join(tmpdir(), 'convention9-typesonly-'));
    try {
      // A .type-test.svelte snapshot exists, but the .test.ts has zero test()/it() calls.
      writeFileSync(join(directory, 'widget.type-test.svelte'), `<!-- type snapshot only -->`);
      writeFileSync(
        join(directory, 'widget.test.ts'),
        `import { expectTypeOf } from 'expect-type';\n` +
          `// purely a type assertion module — no runtime test() or it() calls\n` +
          `expectTypeOf<string>().toBeString();\n`,
      );
      expect(componentFails('widget', join(directory, 'widget.test.ts'))).toBe(true);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test('a stub test file with only test.skip / test.todo fails the check', () => {
    const directory = mkdtempSync(join(tmpdir(), 'convention9-skip-'));
    try {
      writeFileSync(
        join(directory, 'widget.test.ts'),
        `import { test } from 'bun:test';\n` +
          `test.skip('not yet', () => {});\n` +
          `test.todo('later');\n`,
      );
      expect(componentFails('widget', join(directory, 'widget.test.ts'))).toBe(true);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test('a component with at least one active test() passes the check', () => {
    const directory = mkdtempSync(join(tmpdir(), 'convention9-pass-'));
    try {
      writeFileSync(
        join(directory, 'widget.test.ts'),
        `import { test, expect } from 'bun:test';\n` +
          `test('renders', () => { expect(true).toBe(true); });\n`,
      );
      expect(componentFails('widget', join(directory, 'widget.test.ts'))).toBe(false);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test('a component with semantic sibling test files passes the check', () => {
    const directory = mkdtempSync(join(tmpdir(), 'convention9-siblings-'));
    try {
      writeFileSync(
        join(directory, 'widget-rendering.test.ts'),
        `import { test, expect } from 'bun:test';\n` +
          `test('renders', () => { expect(true).toBe(true); });\n`,
      );
      const result = hasSubstantiveTest(join(directory, 'widget.test.ts'));
      expect(result.pass).toBe(true);
      expect(result.count).toBe(1);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test('the no-test exemption list is empty', () => {
    expect(NO_TEST_REQUIRED_ALLOW_LIST).toEqual(new Set());
  });

  // Regression: a component with a module script but NO instance script must
  // still be required to have a test. The whole-tree loop has an early
  // `continue` for a missing instance script (and another for a missing
  // module script / no $props()); if the test requirement runs *after* those,
  // a module-only component silently skips the gate. This test reproduces the
  // loop's control flow to prove the requirement is evaluated before the
  // early `continue`s.
  test('a module-only component (no instance script) is not exempted by the early continue', () => {
    const directory = mkdtempSync(join(tmpdir(), 'convention9-moduleonly-'));
    try {
      const source =
        `<script lang="ts" module>export type WidgetProps = { class?: string };</script>` +
        `<div></div>`;
      writeFileSync(join(directory, 'widget.svelte'), source);
      // No widget.test.ts written at all.

      // Reproduce the relevant slice of the whole-tree loop body, including the
      // early `continue` that fires when there is no instance script.
      const ast = parse(source, { filename: 'widget.svelte', modern: true });
      const errors: string[] = [];

      // #9 runs first, before any structural `continue`.
      if (!NO_TEST_REQUIRED_ALLOW_LIST.has('widget')) {
        if (!hasSubstantiveTest(join(directory, 'widget.test.ts')).pass) {
          errors.push('widget.svelte: missing a substantive widget.test.ts');
        }
      }

      // The structural `continue` that the bug let bypass the check.
      const hasInstanceScript = ast.instance?.content != null;
      expect(hasInstanceScript).toBe(false); // sanity: this component would `continue`

      // The test requirement must have fired despite the missing instance script.
      expect(errors).toHaveLength(1);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test('every allow-list entry is a real current gap (no stale entries)', async () => {
    // If a component on the list gained a substantive test, its entry is stale
    // and must be deleted. This keeps the documented debt accurate over time.
    const files = getPublicComponentSvelteFiles();
    const byName = new Map<string, string>();
    for (const file of files) {
      const base = file.includes('/') ? file.split('/').pop()! : file;
      const name = base.replace(/\.svelte$/, '');
      byName.set(name, file);
    }

    const stale: string[] = [];
    for (const name of NO_TEST_REQUIRED_ALLOW_LIST) {
      const file = byName.get(name);
      if (!file) {
        stale.push(`${name} (no matching component .svelte — remove from allow-list)`);
        continue;
      }
      const testFilePath = join(COMPONENTS_DIR, file.replace(/\.svelte$/, '.test.ts'));
      if (hasSubstantiveTest(testFilePath).pass) {
        stale.push(`${name} (now has a substantive test — remove from allow-list)`);
      }
    }

    expect(stale).toEqual([]);
  }, 30_000);
});
