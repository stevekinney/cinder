import { parse, type AST } from 'svelte/compiler';

export interface AstNode {
  readonly type: string;
}

export function parseSvelte(source: string, filename: string): AST.Root {
  return parse(source, { filename, modern: true });
}

export function scriptStatements(root: AST.Root, context: 'module' | 'instance'): AstNode[] {
  return root[context]?.content.body.filter(isNode) ?? [];
}

export function isNode(value: unknown): value is AstNode {
  return (
    typeof value === 'object' && value !== null && 'type' in value && typeof value.type === 'string'
  );
}

export function nodeField(node: AstNode, name: string): unknown {
  return Reflect.get(node, name);
}

export function childNodes(node: AstNode): AstNode[] {
  const children: AstNode[] = [];
  for (const value of Object.values(node)) {
    if (isNode(value)) children.push(value);
    if (Array.isArray(value)) {
      for (const item of value) if (isNode(item)) children.push(item);
    }
  }
  return children;
}
