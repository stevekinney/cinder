import { describe, expect, test } from 'bun:test';

import { inventoryFromCss, renderInventory } from './inventory.ts';

const sample = `
:root {
  /* ========================================
   * SPACING
   * ======================================== */
  --cinder-space-1: 0.25rem;
  --cinder-alias: var(--cinder-space-1);
  --cinder-derived: color-mix(in oklch, var(--cinder-color), white 10%);
}

@media (prefers-reduced-motion: reduce) {
  :root:not([data-cinder-reduced-motion='false']) {
    --cinder-duration-base: 0ms;
  }
}

:root[data-reduced-motion='on'] {
  --cinder-duration-base: 0ms;
}
`;

describe('token inventory', () => {
  test('classifies root and reduced-motion declarations with their DTCG migration data', () => {
    const entries = inventoryFromCss(sample);

    expect(entries).toEqual([
      {
        cssProperty: '--cinder-alias',
        proposedPath: 'alias',
        section: 'spacing',
        source: 'default',
        value: 'var(--cinder-space-1)',
        aliases: ['--cinder-space-1'],
        needsCssRecipe: false,
      },
      {
        cssProperty: '--cinder-derived',
        proposedPath: 'derived',
        section: 'spacing',
        source: 'default',
        value: 'color-mix(in oklch, var(--cinder-color), white 10%)',
        aliases: ['--cinder-color'],
        needsCssRecipe: true,
      },
      {
        cssProperty: '--cinder-duration-base',
        proposedPath: 'duration.base',
        section: 'unclassified',
        source: 'reduced-motion',
        value: '0ms',
        aliases: [],
        needsCssRecipe: false,
      },
      {
        cssProperty: '--cinder-duration-base',
        proposedPath: 'duration.base',
        section: 'unclassified',
        source: 'forced-reduced-motion',
        value: '0ms',
        aliases: [],
        needsCssRecipe: false,
      },
      {
        cssProperty: '--cinder-space-1',
        proposedPath: 'space.1',
        section: 'spacing',
        source: 'default',
        value: '0.25rem',
        aliases: [],
        needsCssRecipe: false,
      },
    ]);
  });

  test('renders every inventory field into a reviewable table', () => {
    const output = renderInventory(inventoryFromCss(sample));

    expect(output).toContain(
      '| `--cinder-derived` | `derived` | spacing | default | `--cinder-color` | yes |',
    );
    expect(output).toContain(
      '| `--cinder-duration-base` | `duration.base` | unclassified | reduced-motion | — | no |',
    );
  });

  test('keeps multiline values within one Markdown table cell', () => {
    const output = renderInventory([
      {
        cssProperty: '--cinder-gradient',
        proposedPath: 'gradient',
        section: 'color',
        source: 'default',
        aliases: [],
        needsCssRecipe: true,
        value: 'linear-gradient(\n  red | blue\n)',
      },
    ]);

    expect(output).toContain('`linear-gradient( red \\| blue )`');
  });
});
