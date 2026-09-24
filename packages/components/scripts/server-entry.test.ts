import { describe, expect, it } from 'bun:test';

import { createServerEntrySource, parseValueExportSpecifiers } from './server-entry';

describe('parseValueExportSpecifiers', () => {
  it('keeps runtime exports and skips type-only exports', () => {
    expect(parseValueExportSpecifiers('type ButtonProps, buttonVariants')).toEqual([
      { importSpecifier: 'buttonVariants', exportName: 'buttonVariants' },
    ]);
  });

  it('uses the alias as the local runtime export name', () => {
    expect(parseValueExportSpecifiers('Button as RenamedButton')).toEqual([
      { importSpecifier: 'Button as RenamedButton', exportName: 'RenamedButton' },
    ]);
  });
});

describe('createServerEntrySource', () => {
  it('generates valid runtime imports for default, typed, and aliased exports', () => {
    const source = [
      "export { default as Button } from './components/button.svelte';",
      "export { type ButtonProps, buttonVariants, Button as RenamedButton } from './button';",
    ].join('\n');

    const serverEntrySource = createServerEntrySource(source);

    expect(serverEntrySource).toContain(
      "import { default as Button } from './components/button.svelte';",
    );
    expect(serverEntrySource).toContain(
      "import { buttonVariants, Button as RenamedButton } from './button';",
    );
    expect(serverEntrySource).not.toContain('type ButtonProps');
    expect(serverEntrySource).toContain('const RenamedButtonExport = RenamedButton;');
    expect(serverEntrySource).toContain('RenamedButtonExport as RenamedButton');
  });

  it('generates runtime imports for multiline default and named export blocks', () => {
    const source = [
      'export {',
      '  default as ToastRegion,',
      '  useToast,',
      "} from './components/toast-region/index.ts';",
    ].join('\n');

    const serverEntrySource = createServerEntrySource(source);

    expect(serverEntrySource).toContain(
      "import { default as ToastRegion, useToast } from './components/toast-region/index.ts';",
    );
    expect(serverEntrySource).toContain('ToastRegionExport as ToastRegion');
    expect(serverEntrySource).toContain('useToastExport as useToast');
  });

  it('keeps the import-attributes clause on JSON exports and does not bleed into neighboring statements', () => {
    const source = [
      "export { default as Button } from './components/button.svelte';",
      "export { default as tokenResolver } from './tokens/cinder.resolver.json' with { type: 'json' };",
      "export { default as tokenIndex } from './tokens/index.json' with { type: 'json' };",
      "export { default as Card } from './components/card.svelte';",
    ].join('\n');

    const serverEntrySource = createServerEntrySource(source);

    expect(serverEntrySource).toContain(
      "import { default as tokenResolver } from './tokens/cinder.resolver.json' with { type: 'json' };",
    );
    expect(serverEntrySource).toContain(
      "import { default as tokenIndex } from './tokens/index.json' with { type: 'json' };",
    );
    expect(serverEntrySource).toContain(
      "import { default as Button } from './components/button.svelte';",
    );
    expect(serverEntrySource).toContain(
      "import { default as Card } from './components/card.svelte';",
    );
    expect(serverEntrySource).toContain('tokenResolverExport as tokenResolver');
    expect(serverEntrySource).toContain('tokenIndexExport as tokenIndex');
  });

  it('carries plain wildcard re-exports through unchanged', () => {
    const source = [
      "export { default as Button } from './components/button.svelte';",
      "export * from './exports/icons.ts';",
      "export * from './exports/utilities.ts';",
    ].join('\n');

    const serverEntrySource = createServerEntrySource(source);

    expect(serverEntrySource).toContain("export * from './exports/icons.ts';");
    expect(serverEntrySource).toContain("export * from './exports/utilities.ts';");
  });

  it('carries a namespaced wildcard re-export through with its alias', () => {
    const source = "export * as icons from './exports/icons.ts';";

    const serverEntrySource = createServerEntrySource(source);

    expect(serverEntrySource).toContain("export * as icons from './exports/icons.ts';");
  });

  it('drops a type-only wildcard re-export', () => {
    const source = "export type * from './exports/types.ts';";

    const serverEntrySource = createServerEntrySource(source);

    expect(serverEntrySource).not.toContain('./exports/types.ts');
  });
});
