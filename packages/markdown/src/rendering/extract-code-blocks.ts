/**
 * Code block metadata extraction from mdast.
 *
 * DEP-49: Extract code block info for copy hooks in chat messages.
 *
 * @module
 */

import type { Code, Root } from 'mdast';
import { visit } from 'unist-util-visit';
import type { CodeBlockInfo } from './types.js';

/**
 * Extract metadata from all code blocks in the AST.
 *
 * @param root - mdast Root node
 * @returns Array of code block metadata in document order
 */
export function extractCodeBlocks(root: Root): CodeBlockInfo[] {
  const codeBlocks: CodeBlockInfo[] = [];
  let index = 0;

  visit(root, 'code', (node: Code) => {
    codeBlocks.push({
      language: node.lang ?? null,
      meta: node.meta ?? null,
      value: node.value,
      index: index++,
    });
  });

  return codeBlocks;
}
