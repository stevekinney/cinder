import type { Element as HastElement, Root as HastRoot } from 'hast';
import { visit } from 'unist-util-visit';
import type { CodeBlockInfo } from './types.js';

export function wrapNodePlaceholders(tree: HastRoot, codeBlocks: CodeBlockInfo[]): void {
  let placeholderIndex = 0;
  let codeBlockIndex = 0;
  visit(tree, 'element', (node, index, parent) => {
    if (index === undefined || !parent) return undefined;
    const elementParent = parent;
    const code = node.tagName === 'pre' ? findCodeElement(node) : undefined;
    const language = code ? codeBlocks[codeBlockIndex++]?.language : undefined;
    const kind = getPlaceholderKind(node, code, language ?? undefined);
    if (!kind) return undefined;
    elementParent.children.splice(index, 1, {
      type: 'element',
      tagName: 'cinder-markdown-node',
      properties: {
        dataCinderMarkdownKind: kind,
        dataCinderMarkdownIndex: placeholderIndex++,
        ...(language ? { dataLanguage: language } : {}),
      },
      children: [node],
    });
    return index + 1;
  });
}

function findCodeElement(node: HastElement): HastElement | undefined {
  return node.children.find(
    (child): child is HastElement => child.type === 'element' && child.tagName === 'code',
  );
}

function getPlaceholderKind(
  node: HastElement,
  code: HastElement | undefined,
  language: string | undefined,
): 'mermaid' | 'table' | 'code-block' | null {
  if (language === 'mermaid') return 'mermaid';
  if (node.tagName === 'table') return 'table';
  return code ? 'code-block' : null;
}
