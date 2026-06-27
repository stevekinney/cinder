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
      '  default as ChatConversationList,',
      '  deriveConversationSummary,',
      "} from './components/chat-conversation-list/index.ts';",
    ].join('\n');

    const serverEntrySource = createServerEntrySource(source);

    expect(serverEntrySource).toContain(
      "import { default as ChatConversationList, deriveConversationSummary } from './components/chat-conversation-list/index.ts';",
    );
    expect(serverEntrySource).toContain('ChatConversationListExport as ChatConversationList');
    expect(serverEntrySource).toContain(
      'deriveConversationSummaryExport as deriveConversationSummary',
    );
  });
});
