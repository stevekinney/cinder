/**
 * Markdown-aware placeholder scanning over a whole template source.
 *
 * `parseMarkdownPlaceholderTokens` is re-exported by
 * `template-placeholders.ts`. It parses the source with the repository's
 * CommonMark + GFM primitives plus the headless `remark-math` syntax
 * extension, then runs the single-run token grammar over the original source
 * slice of every eligible mdast `text` node. It never scans decoded
 * `node.value`, so escaped and entity-encoded braces stay literal.
 *
 * Boundary: this module imports no rendering, KaTeX, Shiki, DOM, Svelte or
 * editor code from Corvidae source. `remark-math@6.0.0` depends on
 * `micromark-extension-math@3.1.0`, whose entry statically re-exports an HTML
 * extension that imports `katex@0.16.47`. `remark-math` and
 * `micromark-extension-math` declare `sideEffects: false`, so a bundler that
 * honors it can drop that extension; `katex` declares no `sideEffects` field,
 * and unbundled Bun evaluation still evaluates `katex`, although nothing here
 * calls it.
 *
 * @module
 */

import type { Nodes, Root } from 'mdast';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

import { templateFrontMatterPrefixLength } from './placeholder-front-matter.js';
import { parsePlaceholderTokens } from './placeholder-token-scanner.js';
import type { PlaceholderToken } from './types.js';

const BYTE_ORDER_MARK = 0xfeff;

/** Parses only; math nodes exist so their content can be excluded. */
const templateProcessor = unified().use(remarkParse).use(remarkGfm).use(remarkMath);

/**
 * Whether a link's text children are ineligible. Only bracketed links
 * (`[label](url)`) have an author-written label; GFM literal autolinks
 * (`www.example.com`) and angle-bracket autolinks (`<https://…>`) render
 * their destination as text, so their braces stay literal.
 */
function isAutolink(node: Nodes, body: string): boolean {
  if (node.type !== 'link') return false;
  const start = node.position?.start.offset;
  return start === undefined || body[start] !== '[';
}

/**
 * The original-source ranges of every eligible mdast `text` node, in
 * document order. Code, math, raw HTML, images (alt text), definitions,
 * link destinations and titles have no `text` children, so structure alone
 * excludes them; autolinks are excluded explicitly.
 */
function eligibleTextRanges(tree: Root, body: string): Array<readonly [number, number]> {
  const ranges: Array<readonly [number, number]> = [];
  const stack: Nodes[] = [tree];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node.type === 'text') {
      const start = node.position?.start.offset;
      const end = node.position?.end.offset;
      if (start !== undefined && end !== undefined) ranges.push([start, end]);
      continue;
    }
    if (!('children' in node) || isAutolink(node, body)) continue;
    for (let index = node.children.length - 1; index >= 0; index--) {
      stack.push(node.children[index]!);
    }
  }
  return ranges;
}

/**
 * The offset where Markdown parsing of a template body begins: after a
 * closed front-matter prefix, and after a byte order mark at that position
 * because the Markdown parser drops a leading one without counting it.
 */
function bodyStartOffset(source: string): number {
  const prefix = templateFrontMatterPrefixLength(source);
  return source.charCodeAt(prefix) === BYTE_ORDER_MARK ? prefix + 1 : prefix;
}

/**
 * Parse the placeholder tokens that are active in a Markdown template.
 *
 * Tokens are recognized only in ordinary paragraph text, headings, list
 * items, blockquotes, table cells, footnote definitions and bracketed link
 * labels. Front matter (see the private prefix helper), fenced, indented and
 * inline code, raw HTML, inline and block math, link and image destinations
 * and titles, reference definitions, image alt text and autolinks are
 * excluded by their Markdown structure. Each eligible text run is scanned
 * separately with {@link parsePlaceholderTokens}, so a token never spans a
 * formatting boundary: `{{a*b*}}` holds no valid token, and characters that
 * form emphasis, such as `__name__`, split a would-be token.
 *
 * Offsets are zero-based, end-exclusive UTF-16 indices into the original
 * `source`, including any excluded front matter or byte order mark.
 *
 * @param source - A complete Markdown template.
 * @returns Active and malformed tokens in source order.
 */
export function parseMarkdownPlaceholderTokens(source: string): PlaceholderToken[] {
  const base = bodyStartOffset(source);
  const body = source.slice(base);
  const tree = templateProcessor.parse(body);
  const tokens: PlaceholderToken[] = [];
  for (const [start, end] of eligibleTextRanges(tree, body)) {
    for (const token of parsePlaceholderTokens(body.slice(start, end))) {
      tokens.push({
        ...token,
        startOffset: token.startOffset + base + start,
        endOffset: token.endOffset + base + start,
      });
    }
  }
  return tokens.toSorted((left, right) => left.startOffset - right.startOffset);
}
