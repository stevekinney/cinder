import { describe, expect, it } from 'bun:test';

const markdownEditorPath = new URL('./markdown-editor.svelte', import.meta.url);
const editorToolbarPath = new URL('./editor-toolbar/editor-toolbar.svelte', import.meta.url);
const toolbarDropdownPath = new URL('./editor-toolbar/toolbar-dropdown.svelte', import.meta.url);
// Cinder owns `.cinder-markdown-content`'s prose and task-list styling —
// `MarkdownEditor` composes it rather than redeclaring it, so this reaches
// across the package boundary into cinder's own utilities stylesheet.
const utilitiesCssPath = new URL(
  '../../../../../components/src/styles/utilities.css',
  import.meta.url,
);

function stripCssComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '');
}

function normalizeCssWhitespace(source: string): string {
  return source.replace(/\s+/g, ' ');
}

function cssBlock(source: string, selector: string): string {
  return cssBlockFromIndex(source, selector, 0);
}

function cssBlockAfter(source: string, anchor: string, selector: string): string {
  const anchorIndex = source.indexOf(anchor);
  expect(anchorIndex, `Missing CSS anchor: ${anchor}`).toBeGreaterThanOrEqual(0);
  return cssBlockFromIndex(source, selector, anchorIndex);
}

function cssBlockFromIndex(source: string, selector: string, startIndex: number): string {
  const selectorIndex = source.indexOf(selector, startIndex);
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
    expectDeclaration(wrapperBlock, 'align-items', 'flex-start');

    const editorWrapperBlock = cssBlock(markdownEditorSource, '.markdown-editor-wrapper');
    expect(editorWrapperBlock).not.toContain('container-type');

    const editorLayoutBlock = cssBlock(markdownEditorSource, '.markdown-editor-layout');
    expectDeclaration(editorLayoutBlock, 'container-name', 'cinder-markdown-editor');
    expectDeclaration(editorLayoutBlock, 'container-type', 'inline-size');
    expect(editorLayoutBlock).not.toContain('min-height');

    const nestedToolbarBlock = cssBlock(
      markdownEditorSource,
      '.editor-toolbar-wrapper :global(.editor-toolbar)',
    );
    expectDeclaration(nestedToolbarBlock, 'flex', '1 1 32rem');
    expectDeclaration(nestedToolbarBlock, 'min-width', 'min(20rem, 100%)');
    expectDeclaration(nestedToolbarBlock, 'padding', '0');
    expectDeclaration(nestedToolbarBlock, 'border', '0');
    expectDeclaration(nestedToolbarBlock, 'border-radius', '0');
    expectDeclaration(nestedToolbarBlock, 'background', 'transparent');
    expectDeclaration(nestedToolbarBlock, 'row-gap', 'var(--cinder-space-1)');

    const modeToggleBlock = cssBlock(markdownEditorSource, '.toolbar-mode-toggle');
    expectDeclaration(modeToggleBlock, 'display', 'flex');
    expectDeclaration(modeToggleBlock, 'justify-content', 'flex-end');

    const standaloneToolbarBlock = cssBlock(editorToolbarSource, '.editor-toolbar');
    expectDeclaration(
      standaloneToolbarBlock,
      'padding',
      'var(--cinder-space-1) var(--cinder-space-2)',
    );
  });

  it('collapses the toolbar toggle and separators by editor container width', async () => {
    const markdownEditorSource = stripCssComments(await Bun.file(markdownEditorPath).text());
    const narrowContainer = '@container cinder-markdown-editor (max-width: 42rem)';

    expect(markdownEditorSource).toContain(narrowContainer);

    const narrowToolbarBlock = cssBlockAfter(
      markdownEditorSource,
      narrowContainer,
      '.editor-toolbar-wrapper :global(.editor-toolbar)',
    );
    expectDeclaration(narrowToolbarBlock, 'flex-basis', '100%');

    const narrowSeparatorBlock = cssBlockAfter(
      markdownEditorSource,
      narrowContainer,
      '.editor-toolbar-wrapper :global(.toolbar-separator)',
    );
    expectDeclaration(narrowSeparatorBlock, 'display', 'none');

    const narrowModeToggleBlock = cssBlockAfter(
      markdownEditorSource,
      narrowContainer,
      '.toolbar-mode-toggle',
    );
    expectDeclaration(narrowModeToggleBlock, 'flex-basis', '100%');
    expectDeclaration(narrowModeToggleBlock, 'margin-inline-start', '0');
  });

  it('keeps the fixed-position link popover outside the query container', async () => {
    const markdownEditorSource = await Bun.file(markdownEditorPath).text();
    const layoutStartIndex = markdownEditorSource.indexOf('<div class="markdown-editor-layout">');
    const layoutCloseBeforePopover = /<\/div>\s*\{#if linkPopoverOpen/.exec(
      markdownEditorSource.slice(layoutStartIndex),
    );
    const layoutEndIndex =
      layoutCloseBeforePopover === null ? -1 : layoutStartIndex + layoutCloseBeforePopover.index;
    const popoverIndex = markdownEditorSource.indexOf('<LinkPopover');

    expect(layoutStartIndex).toBeGreaterThanOrEqual(0);
    expect(layoutEndIndex).toBeGreaterThan(layoutStartIndex);
    expect(popoverIndex).toBeGreaterThan(layoutEndIndex);
  });

  it('gives raw source mode a usable minimum editing height', async () => {
    const markdownEditorSource = stripCssComments(await Bun.file(markdownEditorPath).text());

    const wrapperBlock = cssBlock(markdownEditorSource, '.markdown-editor-wrapper');
    expectDeclaration(wrapperBlock, '--editor-min-height', '200px');
    expectDeclaration(
      wrapperBlock,
      '--editor-source-min-height',
      'max(var(--editor-min-height), 16rem)',
    );

    const sourceModeBlock = cssBlock(markdownEditorSource, 'textarea.markdown-editor.source-mode');
    expectDeclaration(sourceModeBlock, 'min-height', 'var(--editor-source-min-height)');
    expect(sourceModeBlock).not.toContain('max(');
  });

  it('wires block-type radio menu state through DropdownItem checked', async () => {
    const source = await Bun.file(toolbarDropdownPath).text();

    expect(source).toContain('itemRole="menuitemradio"');
    expect(source).toContain('checked={isActive}');
    expect(source).not.toContain('aria-checked={isActive}');
  });

  it('does not depend on a consumer-global prose class for the rich editor surface', async () => {
    const markdownEditorSource = stripCssComments(await Bun.file(markdownEditorPath).text());
    const classAttributes = [...markdownEditorSource.matchAll(/class="([^"]*)"/g)].map(
      (match) => match[1] ?? '',
    );
    const richEditorSurfaceClass = classAttributes.find(
      (className) =>
        className.includes('cinder-markdown-content') &&
        className.includes('markdown-editor') &&
        className.includes('surface'),
    );

    expect(richEditorSurfaceClass).toBeDefined();
    expect(richEditorSurfaceClass).not.toMatch(/\bprose\b/);
  });

  it('owns markdown prose and task-list styling through cinder-markdown-content', async () => {
    const utilitiesSource = normalizeCssWhitespace(
      stripCssComments(await Bun.file(utilitiesCssPath).text()),
    );

    const requiredSelectors = [
      '.cinder-markdown-content :where(p, ul, ol, blockquote, pre, table)',
      '.cinder-markdown-content :where(h1, h2, h3, h4, h5, h6)',
      '.cinder-markdown-content :where(ul, ol)',
      ".cinder-markdown-content :where( ul[data-type='taskList'], ul.contains-task-list, ol.contains-task-list, ul:has(> li[data-item-type='task']), ol:has(> li[data-item-type='task']) )",
      ".cinder-markdown-content :where(li[data-type='taskItem'], li.task-list-item, li[data-item-type='task'])",
      ".cinder-markdown-content :where(li.task-list-item) > p:first-child > input[type='checkbox']",
      ".cinder-markdown-content :where(li[data-type='taskItem'], li.task-list-item, li[data-item-type='task']) > :where(:not(label):not(input[type='checkbox']))",
      ".cinder-markdown-content :where(li[data-item-type='task'])::before",
      ".cinder-markdown-content :where(li[data-item-type='task'][data-checked='true'])::before",
      '.cinder-markdown-content :where(blockquote)',
      '.cinder-markdown-content :where(pre)',
      '.cinder-markdown-content :where(pre > code)',
      '.cinder-markdown-content :where(:not(pre) > code)',
      '.cinder-markdown-content :where(table)',
      '.cinder-markdown-content :where(th, td)',
      '.cinder-markdown-content :where(th:not([align]), td:not([align]))',
      ".cinder-markdown-content :where(th[align='center'], td[align='center'])",
      ".cinder-markdown-content :where(th[align='right'], td[align='right'])",
    ];

    for (const selector of requiredSelectors) {
      expect(utilitiesSource).toContain(selector);
    }

    expectDeclaration(
      cssBlock(
        utilitiesSource,
        ".cinder-markdown-content :where( ul[data-type='taskList'], ul.contains-task-list, ol.contains-task-list, ul:has(> li[data-item-type='task']), ol:has(> li[data-item-type='task']) )",
      ),
      'list-style',
      'none',
    );
    expectDeclaration(
      cssBlock(
        utilitiesSource,
        ".cinder-markdown-content :where(li[data-type='taskItem'], li.task-list-item, li[data-item-type='task'])",
      ),
      'display',
      'grid',
    );
    expectDeclaration(
      cssBlock(utilitiesSource, '.cinder-markdown-content :where(pre > code)'),
      'font-size',
      '1em',
    );
    expectDeclaration(
      cssBlock(
        utilitiesSource,
        ".cinder-markdown-content :where(th[align='right'], td[align='right'])",
      ),
      'text-align',
      'right',
    );
  });
});
