import { describe, expect, it } from 'bun:test';

const markdownEditorPath = new URL('./markdown-editor.svelte', import.meta.url);
const editorToolbarPath = new URL('./editor-toolbar/editor-toolbar.svelte', import.meta.url);
const toolbarDropdownPath = new URL('./editor-toolbar/toolbar-dropdown.svelte', import.meta.url);
const utilitiesCssPath = new URL('../../styles/utilities.css', import.meta.url);

function stripCssComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '');
}

function normalizeCssWhitespace(source: string): string {
  return source.replace(/\s+/g, ' ');
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

  it('wires block-type radio menu state through DropdownItem checked', async () => {
    const source = await Bun.file(toolbarDropdownPath).text();

    expect(source).toContain('itemRole="menuitemradio"');
    expect(source).toContain('checked={isActive}');
    expect(source).not.toContain('aria-checked={isActive}');
  });

  it('does not depend on a consumer-global prose class for the rich editor surface', async () => {
    const markdownEditorSource = stripCssComments(await Bun.file(markdownEditorPath).text());

    expect(markdownEditorSource).toContain(
      'class="cinder-markdown-content markdown-editor surface"',
    );
    expect(markdownEditorSource).not.toContain('class="cinder-markdown-content prose');
  });

  it('owns markdown prose and task-list styling through cinder-markdown-content', async () => {
    const utilitiesSource = normalizeCssWhitespace(
      stripCssComments(await Bun.file(utilitiesCssPath).text()),
    );

    for (const selector of [
      '.cinder-markdown-content :where(p, ul, ol, blockquote, pre, table)',
      '.cinder-markdown-content :where(h1, h2, h3, h4, h5, h6)',
      '.cinder-markdown-content :where(ul, ol)',
      ".cinder-markdown-content :where(ul[data-type='taskList'], ul.contains-task-list, ul:has(> li[data-item-type='task']))",
      ".cinder-markdown-content :where(li[data-type='taskItem'], li.task-list-item, li[data-item-type='task'])",
      ".cinder-markdown-content :where(li[data-item-type='task'])::before",
      ".cinder-markdown-content :where(li[data-item-type='task'][data-checked='true'])::before",
      '.cinder-markdown-content :where(blockquote)',
      '.cinder-markdown-content :where(pre)',
      '.cinder-markdown-content :where(pre > code)',
      '.cinder-markdown-content :where(:not(pre) > code)',
      '.cinder-markdown-content :where(table)',
      '.cinder-markdown-content :where(th, td)',
    ]) {
      expect(utilitiesSource).toContain(selector);
    }
  });
});
