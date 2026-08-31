import { describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { findReadmeUsageFailures } from './check-readme-usage.ts';

/** Builds a throwaway `src/components`-shaped root from `componentId -> README text`. */
function buildComponentRoot(components: Record<string, string | null>): string {
  const root = mkdtempSync(join(tmpdir(), 'readme-usage-'));
  for (const [componentId, readme] of Object.entries(components)) {
    const directory = join(root, componentId);
    mkdirSync(directory, { recursive: true });
    if (readme !== null) writeFileSync(join(directory, 'README.md'), readme);
  }
  return root;
}

function withComponentRoot(
  components: Record<string, string | null>,
  assert: (root: string) => void,
): void {
  const root = buildComponentRoot(components);
  try {
    assert(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const validReadme = (tag: string) =>
  `# ${tag}\n\nProse.\n\n## Usage\n\n\`\`\`svelte\n<${tag} />\n\`\`\`\n`;

describe('check-readme-usage', () => {
  test('accepts a README with a usage fence rendering the component tag', () => {
    withComponentRoot({ 'donut-chart': validReadme('DonutChart') }, (root) => {
      expect(findReadmeUsageFailures(root)).toEqual([]);
    });
  });

  test('flags the exact #1471 regression: a skeleton README with no `## Usage` heading', () => {
    // Reproduces the shape that turned main-green red for three days and
    // blocked the 0.25.0 publish — prose plus a bare fence, no heading.
    const skeleton =
      '# TerminalFrame\n\nProse about the component.\n\n```svelte\n<TerminalFrame />\n```\n';
    withComponentRoot({ 'terminal-frame': skeleton }, (root) => {
      expect(findReadmeUsageFailures(root)).toEqual([
        {
          componentId: 'terminal-frame',
          reason: 'no-heading',
          readmePath: join(root, 'terminal-frame', 'README.md'),
        },
      ]);
    });
  });

  test('flags a `## Usage` section whose first fence is not a svelte fence', () => {
    const readme = '# FindBar\n\n## Usage\n\n```ts\nconst x = 1;\n```\n';
    withComponentRoot({ 'find-bar': readme }, (root) => {
      expect(findReadmeUsageFailures(root).map((failure) => failure.reason)).toEqual(['no-fence']);
    });
  });

  test('flags a usage fence that imports the component but never renders its tag', () => {
    const readme =
      '# SettingRow\n\n## Usage\n\n```svelte\n<script lang="ts">\n  import SettingRow from \'@lostgradient/cinder/setting-row\';\n</script>\n```\n';
    withComponentRoot({ 'setting-row': readme }, (root) => {
      expect(findReadmeUsageFailures(root).map((failure) => failure.reason)).toEqual([
        'no-matching-tag',
      ]);
    });
  });

  test('does not over-match a longer component name sharing a tag prefix', () => {
    const readme = '# Form\n\n## Usage\n\n```svelte\n<FormField />\n```\n';
    withComponentRoot({ form: readme }, (root) => {
      expect(findReadmeUsageFailures(root).map((failure) => failure.reason)).toEqual([
        'no-matching-tag',
      ]);
    });
  });

  test('exempts compose-only leaves, which document composition through the parent', () => {
    withComponentRoot(
      { 'table-row': '# TableRow\n\nCompose-only leaf of `<Table>`.\n' },
      (root) => {
        expect(findReadmeUsageFailures(root)).toEqual([]);
      },
    );
  });

  test('exempts dotted-namespace leaves but still requires a svelte usage fence', () => {
    const dotted = '# GridItem\n\n## Usage\n\n```svelte\n<Grid.Item />\n```\n';
    withComponentRoot({ 'grid-item': dotted }, (root) => {
      expect(findReadmeUsageFailures(root)).toEqual([]);
    });

    withComponentRoot({ 'grid-item': '# GridItem\n\nNo usage section.\n' }, (root) => {
      expect(findReadmeUsageFailures(root).map((failure) => failure.reason)).toEqual([
        'no-heading',
      ]);
    });
  });

  test('skips private, icon, and README-less directories', () => {
    withComponentRoot(
      {
        _internal: '# Internal\n\nNo usage.\n',
        icons: '# Icons\n\nNo usage.\n',
        'no-readme': null,
      },
      (root) => {
        expect(findReadmeUsageFailures(root)).toEqual([]);
      },
    );
  });

  test('descends one level into experimental/', () => {
    const root = mkdtempSync(join(tmpdir(), 'readme-usage-'));
    try {
      const experimental = join(root, 'experimental', 'live-component');
      mkdirSync(experimental, { recursive: true });
      writeFileSync(join(experimental, 'README.md'), '# LiveComponent\n\nNo usage.\n');
      expect(findReadmeUsageFailures(root)).toEqual([
        {
          componentId: 'live-component',
          reason: 'no-heading',
          readmePath: join(experimental, 'README.md'),
        },
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('reports every offending component, not just the first', () => {
    withComponentRoot(
      {
        'policy-lock': '# PolicyLock\n\nNo usage.\n',
        'shortcut-field': '# ShortcutField\n\nNo usage.\n',
        'zoom-pan-viewer': validReadme('ZoomPanViewer'),
      },
      (root) => {
        expect(findReadmeUsageFailures(root).map((failure) => failure.componentId)).toEqual([
          'policy-lock',
          'shortcut-field',
        ]);
      },
    );
  });
});
