/**
 * Test utilities for creating ProseMirror documents from markdown.
 *
 * These utilities require a browser environment (DOM) to work.
 * Use in `.svelte.test.ts` files which run in browser context.
 *
 * @module
 */

import { defaultValueCtx, Editor, editorViewCtx, rootCtx } from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import type { Node as ProseMirrorNode } from '@milkdown/kit/prose/model';

/**
 * Result of creating a test document.
 */
export interface TestDocument {
  /** The ProseMirror document node */
  doc: ProseMirrorNode;
  /** Full text content via doc.textBetween() */
  text: string;
  /** Cleanup function - call in afterEach */
  destroy: () => void;
}

/**
 * Create a ProseMirror document from markdown for testing.
 *
 * This creates a minimal Milkdown editor with the same schema used in production
 * (CommonMark + GFM), extracts the document, and returns it for testing.
 *
 * @param markdown - Markdown content to parse
 * @returns TestDocument with doc, text, and cleanup function
 *
 * @example
 * ```typescript
 * const { doc, text, destroy } = await createDocFromMarkdown('# Hello\n\nWorld');
 * try {
 *   expect(text).toBe('Hello\nWorld');
 * } finally {
 *   destroy();
 * }
 * ```
 */
export async function createDocFromMarkdown(markdown: string): Promise<TestDocument> {
  if (typeof document === 'undefined') {
    throw new Error('createDocFromMarkdown() requires a browser document.');
  }

  // Create a hidden container for the editor
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  document.body.appendChild(container);

  // Create minimal editor with same schema as production
  const editor = await Editor.make()
    .config((ctx) => {
      ctx.set(rootCtx, container);
      ctx.set(defaultValueCtx, markdown);
    })
    .use(commonmark)
    .use(gfm)
    .create();

  // Extract the document
  const view = editor.ctx.get(editorViewCtx);
  const doc = view.state.doc;
  const text = doc.textBetween(0, doc.content.size, '\n');

  return {
    doc,
    text,
    destroy: () => {
      void editor.destroy();
      container.remove();
    },
  };
}

/**
 * Debug helper: Print document structure to console.
 *
 * Useful for understanding ProseMirror node structure during test development.
 *
 * @param doc - ProseMirror document to inspect
 * @param maxDepth - Maximum depth to print (default: 5)
 */
export function debugDocStructure(doc: ProseMirrorNode, maxDepth = 5): void {
  function printNode(node: ProseMirrorNode, pos: number, indent: number): void {
    if (indent > maxDepth) {
      console.log('  '.repeat(indent) + '...');
      return;
    }

    const isTextblock = node.isTextblock ? ' (textblock)' : '';
    const isBlock = node.isBlock ? ' (block)' : '';
    const content = node.isText ? `: "${node.text}"` : '';

    console.log(
      '  '.repeat(indent) +
        `${node.type.name} [${pos}, ${pos + node.nodeSize})${isTextblock}${isBlock}${content}`,
    );

    if (!node.isLeaf) {
      const childPos = pos + 1;
      node.forEach((child, offset) => {
        printNode(child, childPos + offset, indent + 1);
      });
    }
  }

  console.log('Document structure:');
  printNode(doc, 0, 0);
}
