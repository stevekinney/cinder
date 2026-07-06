import { describe, expect, test } from 'bun:test';

const chatInputPath = new URL('./chat-input.svelte', import.meta.url);
const markdownEditorPath = new URL('../../markdown-editor/markdown-editor.svelte', import.meta.url);

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

    let closed = false;
    let depth = 0;
    for (let index = openingBraceIndex; index < source.length; index++) {
      const character = source[index];
      if (character === '{') depth++;
      if (character === '}') depth--;
      if (depth === 0) {
        blocks.push(source.slice(openingBraceIndex + 1, index));
        searchStart = index + 1;
        closed = true;
        break;
      }
    }

    if (!closed) {
      throw new Error(`Unclosed CSS block for selector: ${selector}`);
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

  test('keeps MarkdownEditor inner layout from forcing the compact composer height', async () => {
    const chatInputSource = stripCssComments(await Bun.file(chatInputPath).text());
    const markdownEditorSource = stripCssComments(await Bun.file(markdownEditorPath).text());

    const chatContainerBlock =
      cssBlocks(chatInputSource, '.chat-input-editor-container').at(0) ?? '';
    expectDeclaration(chatContainerBlock, '--editor-min-height', '2.5rem');
    expectDeclaration(chatContainerBlock, '--editor-source-min-height', 'var(--editor-min-height)');

    const markdownEditorLayoutBlock =
      cssBlocks(markdownEditorSource, '.markdown-editor-layout').at(0) ?? '';
    expect(markdownEditorLayoutBlock).not.toContain('min-height');
  });
});
