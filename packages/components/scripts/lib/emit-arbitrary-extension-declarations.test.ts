import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { emitArbitraryExtensionDeclarations } from './emit-arbitrary-extension-declarations.ts';

let distDir: string;

beforeEach(async () => {
  distDir = await mkdtemp(join(tmpdir(), 'arbitrary-extension-declarations-'));
});

afterEach(async () => {
  await rm(distDir, { recursive: true, force: true });
});

describe('emitArbitraryExtensionDeclarations', () => {
  it('creates a .d.svelte.ts companion from the existing .svelte.d.ts sibling', async () => {
    const componentDir = join(distDir, 'components', 'access-gate');
    await Bun.write(join(componentDir, 'index.d.ts'), "import AccessGate from './access-gate.svelte';\nexport default AccessGate;\n");
    await Bun.write(join(componentDir, 'access-gate.svelte.d.ts'), 'declare const AccessGate: unknown;\nexport default AccessGate;\n');

    const result = await emitArbitraryExtensionDeclarations(distDir);

    expect(result.createdDeclarations).toEqual(['components/access-gate/access-gate.d.svelte.ts']);
    const created = await Bun.file(join(componentDir, 'access-gate.d.svelte.ts')).text();
    expect(created).toBe('declare const AccessGate: unknown;\nexport default AccessGate;\n');
  });

  it('creates an empty .d.css.ts companion for a side-effect CSS import', async () => {
    const componentDir = join(distDir, 'components', 'access-gate');
    await Bun.write(join(componentDir, 'index.d.ts'), "import './access-gate.css';\nexport {};\n");

    const result = await emitArbitraryExtensionDeclarations(distDir);

    expect(result.createdDeclarations).toEqual(['components/access-gate/access-gate.d.css.ts']);
    expect(await Bun.file(join(componentDir, 'access-gate.d.css.ts')).text()).toBe('export {};\n');
  });

  it('is idempotent: a second run against already-fixed output creates nothing', async () => {
    const componentDir = join(distDir, 'components', 'access-gate');
    await Bun.write(join(componentDir, 'index.d.ts'), "import './access-gate.css';\n");
    await emitArbitraryExtensionDeclarations(distDir);

    const second = await emitArbitraryExtensionDeclarations(distDir);
    expect(second.createdDeclarations).toEqual([]);
  });

  it('throws when a .svelte specifier has no legacy declaration sibling to copy from', async () => {
    const componentDir = join(distDir, 'components', 'access-gate');
    await Bun.write(join(componentDir, 'index.d.ts'), "import AccessGate from './access-gate.svelte';\n");

    await expect(emitArbitraryExtensionDeclarations(distDir)).rejects.toThrow(
      /neither .*access-gate\.d\.svelte\.ts nor .*access-gate\.svelte\.d\.ts exists/,
    );
  });

  it('rewrites a bare specifier pointing at a directory to append /index.js', async () => {
    await Bun.write(
      join(distDir, 'components', 'choice-grid', 'index.d.ts'),
      "export type { ChoiceGridItemProps } from '../choice-grid-item';\n",
    );
    await Bun.write(join(distDir, 'components', 'choice-grid-item', 'index.d.ts'), 'export {};\n');

    const result = await emitArbitraryExtensionDeclarations(distDir);

    expect(result.rewrittenSpecifiers).toEqual([
      {
        file: 'components/choice-grid/index.d.ts',
        from: '../choice-grid-item',
        to: '../choice-grid-item/index.js',
      },
    ]);
    const rewritten = await Bun.file(join(distDir, 'components', 'choice-grid', 'index.d.ts')).text();
    expect(rewritten).toBe("export type { ChoiceGridItemProps } from '../choice-grid-item/index.js';\n");
  });

  it('rewrites a bare specifier pointing at a sibling file to append .js', async () => {
    await Bun.write(
      join(distDir, 'components', 'review-editor', 'index.d.ts'),
      "export * from './review-editor-exports';\n",
    );
    await Bun.write(join(distDir, 'components', 'review-editor', 'review-editor-exports.d.ts'), 'export {};\n');

    const result = await emitArbitraryExtensionDeclarations(distDir);

    expect(result.rewrittenSpecifiers).toEqual([
      {
        file: 'components/review-editor/index.d.ts',
        from: './review-editor-exports',
        to: './review-editor-exports.js',
      },
    ]);
  });

  it('throws when an extensionless specifier resolves to neither a file nor a directory', async () => {
    await Bun.write(join(distDir, 'components', 'choice-grid', 'index.d.ts'), "export * from '../nowhere';\n");

    await expect(emitArbitraryExtensionDeclarations(distDir)).rejects.toThrow(/nowhere/);
  });

  it('repoints a bare import(".").TypeName self-reference at the matching same-file re-export path', async () => {
    await Bun.write(
      join(distDir, 'components', 'grid', 'index.d.ts'),
      [
        'declare const Grid: X & { Item: import("svelte").Component<import(".").GridItemProps, {}, ""> };',
        "export type { GridItemProps } from '../grid-item/grid-item.types.ts';",
      ].join('\n'),
    );

    const result = await emitArbitraryExtensionDeclarations(distDir);

    expect(result.fixedSelfReferences).toEqual([
      { file: 'components/grid/index.d.ts', from: '.', to: '../grid-item/grid-item.types.ts' },
    ]);
    const rewritten = await Bun.file(join(distDir, 'components', 'grid', 'index.d.ts')).text();
    expect(rewritten).toContain('import("../grid-item/grid-item.types.ts").GridItemProps');
    expect(rewritten).not.toContain('import(".")');
  });

  it('fixes multiple distinct self-references in the same file independently', async () => {
    await Bun.write(
      join(distDir, 'components', 'tabs', 'index.d.ts'),
      [
        'declare const Tabs: X & { List: import(".").TabListProps; Trigger: import(".").TabProps; };',
        "export type { TabListProps } from '../tab-list/tab-list.types.ts';",
        "export type { TabProps } from '../tab/tab.types.ts';",
      ].join('\n'),
    );

    const result = await emitArbitraryExtensionDeclarations(distDir);

    expect(result.fixedSelfReferences).toEqual([
      { file: 'components/tabs/index.d.ts', from: '.', to: '../tab-list/tab-list.types.ts' },
      { file: 'components/tabs/index.d.ts', from: '.', to: '../tab/tab.types.ts' },
    ]);
    const rewritten = await Bun.file(join(distDir, 'components', 'tabs', 'index.d.ts')).text();
    expect(rewritten).toContain('import("../tab-list/tab-list.types.ts").TabListProps');
    expect(rewritten).toContain('import("../tab/tab.types.ts").TabProps');
  });

  it('throws when a self-reference has no matching same-file re-export to repair it from', async () => {
    await Bun.write(join(distDir, 'components', 'grid', 'index.d.ts'), 'import(".").GridItemProps;');

    await expect(emitArbitraryExtensionDeclarations(distDir)).rejects.toThrow(
      /self-referential import\("\."\)\.GridItemProps/,
    );
  });

  it('is idempotent for extensionless rewrites too: a second run rewrites nothing further', async () => {
    await Bun.write(
      join(distDir, 'components', 'choice-grid', 'index.d.ts'),
      "export type { X } from '../choice-grid-item';\n",
    );
    await Bun.write(join(distDir, 'components', 'choice-grid-item', 'index.d.ts'), 'export {};\n');

    await emitArbitraryExtensionDeclarations(distDir);
    const second = await emitArbitraryExtensionDeclarations(distDir);
    expect(second.rewrittenSpecifiers).toEqual([]);
  });
});
