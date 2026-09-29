import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';

const componentsRoot = join(import.meta.dir, 'components');

describe('Chat package style contracts', () => {
  for (const [component, dependency, stylesheet] of [
    ['chat-composer-popover', 'CommandMenu', 'command-menu'],
    ['chat/export/conversation-export-actions', 'Dropdown', 'dropdown'],
  ]) {
    test(`${component} receives Cinder styles through its public component import`, async () => {
      if (!component || !dependency || !stylesheet)
        throw new Error('Missing style contract fixture');
      const source = await Bun.file(
        join(
          componentsRoot,
          component.includes('/') ? `${component}.svelte` : `${component}/${component}.svelte`,
        ),
      ).text();
      expect(source).toMatch(
        new RegExp(
          `import\\s*\\{[^}]*\\b${dependency}\\b[^}]*\\}\\s*from\\s*['"]@lostgradient/cinder['"]`,
        ),
      );
      const dependencyEntry = await Bun.file(
        join(import.meta.dir, '../../../cinder/src/components', stylesheet, 'index.ts'),
      ).text();
      expect(dependencyEntry).toContain(`import './${stylesheet}.css'`);
    });
  }

  test('Chat status surfaces do not mix solid status tokens into soft surfaces', async () => {
    const auditedFiles = [
      join(componentsRoot, 'chat', 'input', 'chat-input.svelte'),
      join(componentsRoot, 'chat', 'message', 'chat-message.svelte'),
      join(componentsRoot, 'chat', 'message', 'tool-call-timeline.svelte'),
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
