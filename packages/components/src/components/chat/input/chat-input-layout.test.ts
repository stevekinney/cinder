import { describe, expect, test } from 'bun:test';

const chatInputPath = new URL('./chat-input.svelte', import.meta.url);

function stripCssComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '');
}

function cssBlocks(source: string, selector: string): string[] {
  const blocks: string[] = [];
  let searchStart = 0;

  while (searchStart < source.length) {
    const selectorIndex = source.indexOf(selector, searchStart);
    if (selectorIndex === -1) break;

    const openingBraceIndex = source.indexOf('{', selectorIndex);
    expect(openingBraceIndex, `Missing CSS block for selector: ${selector}`).toBeGreaterThanOrEqual(
      0,
    );

    let depth = 0;
    for (let index = openingBraceIndex; index < source.length; index++) {
      const character = source[index];
      if (character === '{') depth++;
      if (character === '}') depth--;
      if (depth === 0) {
        blocks.push(source.slice(openingBraceIndex + 1, index));
        searchStart = index + 1;
        break;
      }
    }
  }

  expect(blocks.length, `Missing CSS selector: ${selector}`).toBeGreaterThan(0);
  return blocks;
}

function expectDeclaration(block: string, property: string, value: string): void {
  const escapedValue = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const declaration = new RegExp(`${property}\\s*:\\s*${escapedValue}\\s*;`);
  expect(block).toMatch(declaration);
}

describe('ChatInput layout CSS', () => {
  test('gives the embedded ProseMirror surface non-zero tokenized horizontal padding', async () => {
    const chatInputSource = stripCssComments(await Bun.file(chatInputPath).text());
    const proseMirrorBlocks = cssBlocks(
      chatInputSource,
      '.chat-input-editor-container :global(.ProseMirror)',
    );

    expectDeclaration(
      proseMirrorBlocks.at(-1) ?? '',
      'padding',
      'var(--cinder-space-1) var(--cinder-space-3)',
    );
  });
});
