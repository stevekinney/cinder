import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';

const componentsRoot = join(import.meta.dir, 'components');

describe('Chat package style contracts', () => {
  test('ChatComposerPopover imports the Cinder CommandMenu style subpath', async () => {
    const source = await Bun.file(
      join(componentsRoot, 'chat-composer-popover', 'chat-composer-popover.css'),
    ).text();
    expect(source).toMatch(/@import\s+['"]@lostgradient\/cinder\/command-menu\/styles['"]/);
  });

  test('ChatConversationHeader imports the Cinder Dropdown style subpath', async () => {
    const source = await Bun.file(
      join(componentsRoot, 'chat-conversation-header', 'chat-conversation-header.css'),
    ).text();
    expect(source).toMatch(/@import\s+['"]@lostgradient\/cinder\/dropdown\/styles['"]/);
  });

  test('Chat status surfaces do not mix solid status tokens into soft surfaces', async () => {
    const auditedFiles = [
      join(componentsRoot, 'chat', 'input', 'chat-input.svelte'),
      join(componentsRoot, 'chat', 'message', 'chat-message.svelte'),
      join(componentsRoot, 'chat', 'message', 'tool-call-group.svelte'),
    ];
    const forbiddenStatusMixPattern =
      /color-mix\((?:(?!;).|\r|\n)*?var\(\s*--cinder-(info|success|warning|danger)\s*(?:[,)\s])/m;
    const failures: string[] = [];
    for (const file of auditedFiles) {
      if (forbiddenStatusMixPattern.test(await Bun.file(file).text())) failures.push(file);
    }
    expect(failures).toEqual([]);
  });
});
