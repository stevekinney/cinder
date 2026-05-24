import { describe, expect, it } from 'bun:test';

const markdownEditorPath = new URL('./markdown-editor.svelte', import.meta.url);
const editorToolbarPath = new URL('./editor-toolbar/editor-toolbar.svelte', import.meta.url);

function stripCssComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '');
}

function cssBlock(source: string, selector: string): string {
  const selectorIndex = source.indexOf(selector);
  expect(selectorIndex, `Missing CSS selector: ${selector}`).toBeGreaterThanOrEqual(0);

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
      return source.slice(openingBraceIndex + 1, index);
    }
  }

  throw new Error(`Unclosed CSS block for selector: ${selector}`);
}

function expectDeclaration(block: string, property: string, value: string): void {
  const escapedValue = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const declaration = new RegExp(`${property}\\s*:\\s*${escapedValue}\\s*;`);
  expect(block).toMatch(declaration);
}

describe('MarkdownEditor toolbar layout CSS ownership', () => {
  it('keeps nested toolbar padding on the wrapper and standalone padding on EditorToolbar', async () => {
    const markdownEditorSource = stripCssComments(await Bun.file(markdownEditorPath).text());
    const editorToolbarSource = stripCssComments(await Bun.file(editorToolbarPath).text());

    const wrapperBlock = cssBlock(markdownEditorSource, '.editor-toolbar-wrapper');
    expectDeclaration(wrapperBlock, 'padding', 'var(--cinder-space-2) var(--cinder-space-3)');

    const nestedToolbarBlock = cssBlock(
      markdownEditorSource,
      '.editor-toolbar-wrapper :global(.editor-toolbar)',
    );
    expectDeclaration(nestedToolbarBlock, 'min-width', 'min(16rem, 100%)');
    expectDeclaration(nestedToolbarBlock, 'padding', '0');
    expectDeclaration(nestedToolbarBlock, 'border', '0');
    expectDeclaration(nestedToolbarBlock, 'border-radius', '0');
    expectDeclaration(nestedToolbarBlock, 'background', 'transparent');

    const standaloneToolbarBlock = cssBlock(editorToolbarSource, '.editor-toolbar');
    expectDeclaration(
      standaloneToolbarBlock,
      'padding',
      'var(--cinder-space-1) var(--cinder-space-2)',
    );
  });
});
