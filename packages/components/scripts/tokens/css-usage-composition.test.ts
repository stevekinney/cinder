import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { inventoryFromSources } from './css-usage-inventory';

const publicProperties = new Set(['--public-a', '--public-b', '--cinder-alert-info']);
const source = (path: string, content: string, stylesheetEntry = false) => ({
  path,
  content,
  stylesheetEntry,
});

describe('CSS same-element composition', () => {
  test('requires compatible static attribute values on terminals and producers', () => {
    const inputs = (markup: string) => [
      source('styles/shared.css', '[data-kind="info"] { color: var(--_private); }', true),
      source(
        'components/owner/owner.css',
        '.owner[data-kind="info"] { --_private: var(--public-a); }',
        true,
      ),
      source('components/owner/owner.svelte', markup),
    ];
    expect(
      inventoryFromSources(inputs('<div class="owner" data-kind="danger"></div>'), publicProperties)
        .uses,
    ).toHaveLength(0);
    expect(
      inventoryFromSources(inputs('<div class="owner" data-kind="info"></div>'), publicProperties)
        .uses,
    ).toHaveLength(1);
    expect(
      inventoryFromSources(inputs('<div class="owner" data-kind={kind}></div>'), publicProperties)
        .uses,
    ).toHaveLength(1);
  });

  test('matches static IDs and does not infer computed class keys', () => {
    const report = inventoryFromSources(
      [
        source('styles/shared.css', '#target { color: var(--_private); }', true),
        source('components/owner/owner.css', '#target { --_private: var(--public-a); }', true),
        source('components/owner/owner.svelte', '<span id="target"></span>'),
      ],
      publicProperties,
    );
    expect(report.uses).toHaveLength(1);
    const computed = inventoryFromSources(
      [
        source('styles/shared.css', '.shared { color: var(--_private); }', true),
        source('components/owner/owner.css', '.owner { --_private: var(--public-a); }', true),
        source(
          'components/owner/owner.svelte',
          '<div class={{ owner: true, [shared]: true }}></div>',
        ),
      ],
      publicProperties,
    );
    expect(computed.uses).toHaveLength(0);
  });

  test('resolves an imported shared recipe from the owner on one element', () => {
    const report = inventoryFromSources(
      [
        source('styles/index.css', "@import './shared.css';", true),
        source('styles/shared.css', '.shared { color: var(--_private); }'),
        source(
          'components/owner/owner.css',
          '.cinder-owner { --_private: var(--public-a); }',
          true,
        ),
        source(
          'components/owner/owner.svelte',
          "<div class={classNames('cinder-owner', 'shared')}></div>",
        ),
      ],
      publicProperties,
    );
    expect(report.uses).toContainEqual(
      expect.objectContaining({
        file: 'styles/shared.css',
        property: 'color',
        tokenProperty: '--public-a',
      }),
    );
  });

  test('maps Alert info surface and border, but not Callout stripe', () => {
    const root = resolve(import.meta.dir, '../../src');
    const read = (path: string): string => readFileSync(resolve(root, path), 'utf8');
    const report = inventoryFromSources(
      [
        source(
          'packages/components/src/styles/components.css',
          read('styles/components.css'),
          true,
        ),
        source(
          'packages/components/src/styles/components/_status-surface.css',
          read('styles/components/_status-surface.css'),
        ),
        source('packages/components/src/styles/tokens-base.css', read('styles/tokens-base.css')),
        source(
          'packages/components/src/components/alert/alert.css',
          read('components/alert/alert.css'),
          true,
        ),
        source(
          'packages/components/src/components/alert/alert.svelte',
          read('components/alert/alert.svelte'),
        ),
      ],
      new Set([
        '--cinder-alert-info',
        '--cinder-status-success-solid',
        '--cinder-status-warning-solid',
        '--cinder-status-danger-solid',
      ]),
    );
    const alertUses = report.uses.filter(
      (use) =>
        use.file.endsWith('_status-surface.css') && use.tokenProperty === '--cinder-alert-info',
    );
    expect(alertUses.map((use) => use.property).toSorted()).toEqual([
      'background-color',
      'border-color',
      'color',
    ]);
    expect(
      report.uses.some(
        (use) =>
          use.file.endsWith('_status-surface.css') && use.property === 'border-inline-start-color',
      ),
    ).toBe(false);
  });

  test('does not compose classes rendered on sibling elements', () => {
    const report = inventoryFromSources(
      [
        source('styles/index.css', "@import './shared.css';", true),
        source('styles/shared.css', '.shared { color: var(--_private); }'),
        source('components/owner/owner.css', '.owner { --_private: var(--public-a); }', true),
        source(
          'components/owner/owner.svelte',
          '<div class="cinder-owner"></div><div class="shared"></div>',
        ),
      ],
      publicProperties,
    );
    expect(report.uses.some((use) => use.file === 'styles/shared.css')).toBe(false);
  });

  test('does not join unrelated owners through an aggregate stylesheet', () => {
    const report = inventoryFromSources(
      [
        source('styles/all.css', "@import './shared.css';", true),
        source('styles/shared.css', '.shared { color: var(--_private); }'),
        source('components/one/one.css', '.cinder-one { --_private: var(--public-a); }', true),
        source('components/two/two.css', '.cinder-two { --_private: var(--public-b); }', true),
        source('components/one/one.svelte', '<div class="cinder-one shared"></div>'),
        source('components/two/two.svelte', '<div class="cinder-two"></div>'),
      ],
      publicProperties,
    );
    expect(
      report.uses.filter((use) => use.file === 'styles/shared.css').map((use) => use.tokenProperty),
    ).toEqual(['--public-a']);
  });

  test('does not activate an unreferenced shared partial', () => {
    const report = inventoryFromSources(
      [
        source('styles/index.css', '/* no import */', true),
        source('styles/unreferenced.css', '.shared { color: var(--_private); }'),
        source('components/owner/owner.css', '.owner { --_private: var(--public-a); }', true),
        source('components/owner/owner.svelte', '<div class="cinder-owner shared"></div>'),
      ],
      publicProperties,
    );
    expect(report.uses.some((use) => use.file === 'styles/unreferenced.css')).toBe(false);
  });

  test('follows a nested private chain and reports a same-element cycle', () => {
    const nested = inventoryFromSources(
      [
        source('styles/index.css', "@import './shared.css';", true),
        source('styles/shared.css', '.shared { color: var(--_first); }'),
        source(
          'components/owner/owner.css',
          '.cinder-owner { --_first: var(--_second); --_second: var(--public-a); }',
          true,
        ),
        source('components/owner/owner.svelte', '<div class="cinder-owner shared"></div>'),
      ],
      publicProperties,
    );
    expect(nested.uses.some((use) => use.tokenProperty === '--public-a')).toBe(true);

    const cycle = inventoryFromSources(
      [
        source('styles/index.css', "@import './shared.css';", true),
        source('styles/shared.css', '.shared { color: var(--_first); }'),
        source(
          'components/owner/owner.css',
          '.cinder-owner { --_first: var(--_second); --_second: var(--_first); }',
          true,
        ),
        source('components/owner/owner.svelte', '<div class="cinder-owner shared"></div>'),
      ],
      publicProperties,
    );
    expect(cycle.diagnostics.some((diagnostic) => diagnostic.kind === 'cycle')).toBe(true);
  });

  test('does not infer classes from comments or unrelated JavaScript strings', () => {
    const report = inventoryFromSources(
      [
        source('styles/index.css', "@import './shared.css';", true),
        source('styles/shared.css', '.shared { color: var(--_private); }'),
        source(
          'components/owner/owner.css',
          '.cinder-owner { --_private: var(--public-a); }',
          true,
        ),
        source(
          'components/owner/owner.svelte',
          '<script>const markup = \'<div class="shared">\';</script><!-- <div class="shared"> --><div class="cinder-owner"></div>',
        ),
      ],
      publicProperties,
    );
    expect(report.uses.some((use) => use.file === 'styles/shared.css')).toBe(false);
  });

  test('associates an explicitly imported owner stylesheet with its element', () => {
    const report = inventoryFromSources(
      [
        source('styles/index.css', "@import './shared.css';", true),
        source('styles/shared.css', '.shared { color: var(--_private); }'),
        source(
          'components/owner/styles/owner.css',
          '.cinder-owner { --_private: var(--public-a); }',
        ),
        source(
          'components/owner/owner.svelte',
          '<script>import \'./styles/owner.css\';</script><div class="cinder-owner shared"></div>',
        ),
      ],
      publicProperties,
    );
    expect(report.uses.some((use) => use.tokenProperty === '--public-a')).toBe(true);
  });

  test('preserves selector alternatives and rejects tag and id mismatches', () => {
    const report = inventoryFromSources(
      [
        source('styles/index.css', "@import './shared.css';", true),
        source('styles/shared.css', '.shared, .alternate { color: var(--_private); }'),
        source(
          'components/owner/owner.css',
          '.cinder-owner { --_private: var(--public-a); } button, #target { --_private: var(--public-a); }',
          true,
        ),
        source(
          'components/owner/owner.svelte',
          '<span class="cinder-owner shared"></span><button></button><span id="other"></span>',
        ),
        source('styles/tag.css', 'button { color: var(--_private); }', true),
        source('styles/id.css', '#target { color: var(--_private); }', true),
      ],
      publicProperties,
    );
    expect(report.uses.filter((use) => use.file === 'styles/shared.css')).toHaveLength(1);
    expect(report.uses.some((use) => use.file === 'styles/tag.css')).toBe(true);
    expect(report.uses.some((use) => use.file === 'styles/id.css')).toBe(false);
  });

  test('follows transitive owner imports and local Svelte style blocks', () => {
    const imported = inventoryFromSources(
      [
        source('styles/index.css', "@import './nested/a.css';", true),
        source('styles/nested/a.css', "@import './b.css';"),
        source('styles/nested/b.css', '.shared { color: var(--_private); }'),
        source('components/owner/owner.css', "@import './owner-input.css';", true),
        source(
          'components/owner/owner-input.css',
          '.cinder-owner { --_private: var(--public-a); }',
        ),
        source('components/owner/owner.svelte', '<div class="cinder-owner shared"></div>'),
      ],
      publicProperties,
    );
    expect(imported.uses.some((use) => use.file === 'styles/nested/b.css')).toBe(true);

    const local = inventoryFromSources(
      [
        source('styles/index.css', "@import './shared.css';", true),
        source('styles/shared.css', '.shared { color: var(--_private); }'),
        source(
          'components/owner/owner.svelte',
          '<style>.cinder-owner { --_private: var(--public-a); }</style><div class="cinder-owner shared"></div>',
        ),
      ],
      publicProperties,
    );
    expect(local.uses.some((use) => use.file === 'styles/shared.css')).toBe(true);
  });

  test('reads identifier object keys and keeps same-line elements distinct', () => {
    const report = inventoryFromSources(
      [
        source('styles/index.css', "@import './shared.css';", true),
        source('styles/shared.css', '.shared { color: var(--_private); }'),
        source('components/owner/owner.css', '.owner { --_private: var(--public-a); }', true),
        source(
          'components/owner/owner.svelte',
          '<div class={{ owner: true, shared: true }}></div><div class="shared"></div>',
        ),
      ],
      publicProperties,
    );
    expect(report.uses.filter((use) => use.file === 'styles/shared.css')).toHaveLength(1);
  });

  test('matches supported state and pseudo-element terminals to their originating element', () => {
    const report = inventoryFromSources(
      [
        source(
          'styles/shared.css',
          '.control:focus-visible { box-shadow: var(--_ring); }\n' +
            '.fade::before { background: var(--_before); }\n' +
            '.fade::after { background: var(--_after); }\n' +
            '.fade::after { border-color: var(--_before-only); }\n' +
            '.fade { color: var(--_before-only); }\n' +
            '.functional:is(.fade)::before { color: var(--_unsupported); }\n' +
            '::before { color: var(--_pseudo-only); }',
          true,
        ),
        source(
          'components/owner/owner.css',
          '.control { --_ring: var(--public-a); }\n' +
            '.fade { --_before: var(--public-b); --_after: var(--public-a); }\n' +
            '.fade::before { --_before: var(--public-a); }\n' +
            '.fade::after { --_after: var(--public-b); }\n' +
            '.fade::before { --_before-only: var(--public-a); }',
          true,
        ),
        source(
          'components/owner/owner.svelte',
          '<button class="control"></button><div class="fade functional"></div><div class="unrelated"></div>',
        ),
      ],
      new Set(['--public-a', '--public-b']),
    );
    expect(
      report.uses
        .filter((use) => use.file === 'styles/shared.css')
        .map((use) => [use.value, use.tokenProperty])
        .toSorted((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
    ).toEqual([
      ['var(--_after)', '--public-a'],
      ['var(--_after)', '--public-b'],
      ['var(--_before)', '--public-a'],
      ['var(--_before)', '--public-b'],
      ['var(--_ring)', '--public-a'],
    ]);
    expect(report.uses.some((use) => use.value === 'var(--_unsupported)')).toBe(false);
    expect(report.uses.some((use) => use.value === 'var(--_before-only)')).toBe(false);
    expect(report.uses.some((use) => use.value === 'var(--_pseudo-only)')).toBe(false);
  });

  test('reaches real control-item and scroll-fade recipes through pseudo terminals', () => {
    const root = resolve(import.meta.dir, '../../src');
    const read = (path: string): string => readFileSync(resolve(root, path), 'utf8');
    const report = inventoryFromSources(
      [
        source(
          'packages/components/src/styles/foundation.css',
          read('styles/foundation.css'),
          true,
        ),
        source(
          'packages/components/src/styles/components/_control-item.css',
          read('styles/components/_control-item.css'),
          true,
        ),
        source(
          'packages/components/src/styles/components/_scroll-fade.css',
          read('styles/components/_scroll-fade.css'),
          true,
        ),
        source(
          'packages/components/src/components/code-block/code-block.css',
          read('components/code-block/code-block.css'),
          true,
        ),
        source(
          'packages/components/src/components/fixture/fixture.svelte',
          '<script>\n' +
            "import '../../styles/foundation.css';\n" +
            "import '../../styles/components/_control-item.css';\n" +
            "import '../../styles/components/_scroll-fade.css';\n" +
            "import '../code-block/code-block.css';\n" +
            '</script>\n' +
            '<div data-theme="dark" class="cinder-_control-item cinder-code-block cinder-code-block__viewport cinder-_scroll-fade cinder-_scroll-fade-start"></div>',
        ),
      ],
      new Set([
        '--cinder-ring-offset-color',
        '--cinder-ring-offset',
        '--cinder-ring-width',
        '--cinder-ring-color',
        '--cinder-space-6',
        '--cinder-code-block-background',
      ]),
    );
    expect(
      report.uses.some(
        (use) =>
          use.file.endsWith('_control-item.css') &&
          use.property === 'box-shadow' &&
          use.value.includes('--_cinder-focus-ring-shadow'),
      ),
    ).toBe(true);
    expect(
      report.uses.some(
        (use) =>
          use.file.endsWith('_scroll-fade.css') &&
          use.property === 'background' &&
          use.value.includes('--_cinder-scroll-fade-color'),
      ),
    ).toBe(true);
    expect(
      report.uses.some(
        (use) =>
          use.file.endsWith('_scroll-fade.css') &&
          use.property === 'block-size' &&
          use.tokenProperty === '--cinder-space-6',
      ),
    ).toBe(true);
  });
});
