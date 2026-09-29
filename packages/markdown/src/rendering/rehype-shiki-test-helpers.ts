import type { Element, ElementContent } from 'hast';

export function createCodeBlockTree(
  code: string,
  language?: string,
): { type: 'root'; children: Element[] } {
  const codeElement: Element = {
    type: 'element',
    tagName: 'code',
    properties: language ? { className: [`language-${language}`] } : {},
    children: [{ type: 'text', value: code }],
  };
  return {
    type: 'root',
    children: [{ type: 'element', tagName: 'pre', properties: {}, children: [codeElement] }],
  };
}

export function extractTextFromElement(element: Element): string {
  return collectText(element.children);
}

export function extractLanguageFromClass(element: Element): string | null {
  const className = element.properties?.['className'];
  if (!Array.isArray(className)) return null;
  for (const cls of className) {
    if (typeof cls !== 'string') continue;
    if (cls.startsWith('language-')) return cls.slice(9);
    if (cls.startsWith('lang-')) return cls.slice(5);
  }
  return null;
}

export function collectAllText(element: Element): string {
  return collectText(element.children);
}

function collectText(nodes: ElementContent[]): string {
  return nodes
    .map((node) =>
      node.type === 'text' ? node.value : node.type === 'element' ? collectText(node.children) : '',
    )
    .join('');
}
