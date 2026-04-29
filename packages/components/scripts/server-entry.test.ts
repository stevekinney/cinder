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

    expect(serverEntrySource).toContain("import Button from '../../src/components/button.svelte';");
    expect(serverEntrySource).toContain(
      "import { buttonVariants, Button as RenamedButton } from '../../src/button';",
    );
    expect(serverEntrySource).not.toContain('type ButtonProps');
    expect(serverEntrySource).toContain('const RenamedButtonExport = RenamedButton;');
    expect(serverEntrySource).toContain('RenamedButtonExport as RenamedButton');
  });
});
