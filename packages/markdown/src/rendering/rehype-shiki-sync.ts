/**
 * Synchronous rehype plugin for Shiki syntax highlighting.
 *
 * DEP-79: Add syntax highlighting to code blocks across the application.
 *
 * This plugin transforms `pre > code` elements in hast to highlighted HTML
 * using a pre-initialized Shiki highlighter. Unlike the standard @shikijs/rehype
 * plugin, this one is fully synchronous, enabling use with unified's `runSync()`.
 *
 * **Important**: The highlighter must be initialized before this plugin runs.
 * If the highlighter is not ready, code blocks are left unhighlighted.
 *
 * @module
 */

import type { Element, ElementContent, Root } from 'hast';
import { visit } from 'unist-util-visit';
import {
  getHighlighterSync,
  isBundledLanguage,
  PLAINTEXT_LANGUAGE,
  type SupportedLanguage,
} from './highlighter.js';

/**
 * Options for the synchronous Shiki rehype plugin.
 */
export interface RehypeShikiSyncOptions {
  /** Theme name to use (must be registered with the highlighter). Default: 'depict' */
  theme?: string;
  /** Default language for code blocks without a specified language. Default: 'plaintext' */
  defaultLanguage?: SupportedLanguage;
}

/**
 * Extract language from a code element's class list.
 *
 * Looks for classes matching `language-*` or `lang-*` patterns,
 * which are the standard ways to specify language in markdown code blocks.
 *
 * @param element - The code element to extract language from
 * @returns The language identifier, or null if not found
 */
function extractLanguage(element: Element): string | null {
  const className = element.properties?.['className'];
  if (!Array.isArray(className)) return null;

  for (const cls of className) {
    if (typeof cls !== 'string') continue;

    // Check for language-* pattern (standard)
    if (cls.startsWith('language-')) {
      return cls.slice(9); // Remove 'language-' prefix
    }
    // Check for lang-* pattern (alternative)
    if (cls.startsWith('lang-')) {
      return cls.slice(5); // Remove 'lang-' prefix
    }
  }

  return null;
}

/**
 * Extract text content from a hast element.
 *
 * Recursively collects all text nodes within the element.
 *
 * @param element - The element to extract text from
 * @returns The concatenated text content
 */
function extractText(element: Element): string {
  let text = '';

  function walk(nodes: ElementContent[]) {
    for (const node of nodes) {
      if (node.type === 'text') {
        text += node.value;
      } else if (node.type === 'element' && 'children' in node) {
        walk(node.children);
      }
    }
  }

  walk(element.children);
  return text;
}

/**
 * Parse Shiki's HTML output into hast nodes.
 *
 * Shiki returns a string like `<pre class="shiki" ...><code>...</code></pre>`.
 * We need to convert this to hast nodes to insert into the tree.
 *
 * This is a simplified parser that handles Shiki's specific output format.
 * It extracts the attributes from the pre element and the inner content.
 *
 * @param html - The HTML string from Shiki
 * @returns The parsed hast element
 */
function parseShikiHtml(html: string): Element {
  // Shiki outputs: <pre class="..." style="..." tabindex="0"><code>...</code></pre>
  // We need to extract the pre element's attributes and the code content

  // Extract pre tag attributes
  const preMatch = html.match(/<pre([^>]*)>/);
  const preAttrs = preMatch?.[1] ?? '';

  // Extract classes
  const classMatch = preAttrs.match(/class="([^"]*)"/);
  const className = classMatch?.[1]?.split(/\s+/) ?? [];

  // Extract style (for Shiki's inline styles)
  const styleMatch = preAttrs.match(/style="([^"]*)"/);
  const style = styleMatch?.[1];

  // Extract data-language attribute
  const langMatch = preAttrs.match(/data-language="([^"]*)"/);
  const dataLanguage = langMatch?.[1];

  // Extract tabindex
  const tabindexMatch = preAttrs.match(/tabindex="([^"]*)"/);
  const tabindex = tabindexMatch?.[1];

  // Extract the inner content (between <pre...> and </pre>)
  const innerMatch = html.match(/<pre[^>]*>([\s\S]*)<\/pre>/);
  const innerHtml = innerMatch?.[1] ?? '';

  // Parse the inner code element
  const codeMatch = innerHtml.match(/<code([^>]*)>([\s\S]*)<\/code>/);
  const codeAttrs = codeMatch?.[1] ?? '';
  const codeContent = codeMatch?.[2] ?? innerHtml;

  // Extract code classes
  const codeClassMatch = codeAttrs.match(/class="([^"]*)"/);
  const codeClassName = codeClassMatch?.[1]?.split(/\s+/) ?? [];

  // Parse the highlighted spans within the code
  const codeChildren = parseSpans(codeContent);

  // Build the code element
  const codeElement: Element = {
    type: 'element',
    tagName: 'code',
    properties: {
      className: codeClassName.length > 0 ? codeClassName : undefined,
    },
    children: codeChildren,
  };

  // Build the pre element
  const preElement: Element = {
    type: 'element',
    tagName: 'pre',
    properties: {
      className: className.length > 0 ? className : undefined,
      style: style || undefined,
      dataLanguage: dataLanguage || undefined,
      tabIndex: tabindex ? parseInt(tabindex, 10) : undefined,
    },
    children: [codeElement],
  };

  return preElement;
}

/**
 * Parse Shiki's span elements into hast nodes.
 *
 * Shiki wraps each line in a `<span class="line">` with nested token spans.
 * This function recursively parses the nested structure.
 *
 * @param html - The inner HTML content with spans
 * @returns Array of hast element/text nodes
 */
function parseSpans(html: string): ElementContent[] {
  const children: ElementContent[] = [];
  let position = 0;

  while (position < html.length) {
    // Check for start of a span tag
    if (html.slice(position, position + 5) === '<span') {
      // Find the end of the opening tag
      const tagEnd = html.indexOf('>', position);
      if (tagEnd === -1) break;

      const openingTag = html.slice(position, tagEnd + 1);
      const attrs = openingTag.slice(5, -1); // Remove '<span' and '>'

      // Find the matching closing tag (accounting for nested spans)
      const innerStart = tagEnd + 1;
      let depth = 1;
      let searchPos = innerStart;
      let closingStart = -1;

      while (depth > 0 && searchPos < html.length) {
        const nextOpen = html.indexOf('<span', searchPos);
        const nextClose = html.indexOf('</span>', searchPos);

        if (nextClose === -1) break;

        if (nextOpen !== -1 && nextOpen < nextClose) {
          depth++;
          searchPos = nextOpen + 5;
        } else {
          depth--;
          if (depth === 0) {
            closingStart = nextClose;
          }
          searchPos = nextClose + 7;
        }
      }

      if (closingStart === -1) break;

      const innerHtml = html.slice(innerStart, closingStart);

      // Parse attributes
      const styleMatch = attrs.match(/style="([^"]*)"/);
      const style = styleMatch?.[1];

      const classMatch = attrs.match(/class="([^"]*)"/);
      const className = classMatch?.[1]?.split(/\s+/);

      // Recursively parse inner content (handles nested spans)
      const innerChildren = innerHtml.includes('<span')
        ? parseSpans(innerHtml)
        : innerHtml
          ? [{ type: 'text' as const, value: decodeHtmlEntities(innerHtml) }]
          : [];

      children.push({
        type: 'element',
        tagName: 'span',
        properties: {
          style: style || undefined,
          className: className,
        },
        children: innerChildren,
      });

      position = closingStart + 7; // Move past '</span>'
    } else if (html[position] === '<') {
      // Skip any other tags (shouldn't happen with Shiki output, but be safe)
      const tagEnd = html.indexOf('>', position);
      if (tagEnd === -1) break;
      position = tagEnd + 1;
    } else {
      // Plain text - collect until next '<' or end
      const nextTag = html.indexOf('<', position);
      const textEnd = nextTag === -1 ? html.length : nextTag;
      const text = html.slice(position, textEnd);
      if (text) {
        children.push({ type: 'text', value: decodeHtmlEntities(text) });
      }
      position = textEnd;
    }
  }

  return children;
}

/**
 * Decode HTML entities in text content.
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#x3C;/gi, '<')
    .replace(/&#x3E;/gi, '>')
    .replace(/&#x26;/gi, '&')
    .replace(/&#x22;/gi, '"')
    .replace(/&#x27;/gi, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x2F;/g, '/');
}

/**
 * Normalize language identifiers to match Shiki's expectations.
 *
 * @param language - The language identifier from the code block
 * @returns The normalized language, or 'plaintext' if unknown
 */
function normalizeLanguage(language: string): SupportedLanguage {
  const normalized = language.toLowerCase();

  // Common aliases - map to bundled languages or plaintext
  const aliases: Record<string, SupportedLanguage> = {
    ts: 'typescript',
    js: 'javascript',
    py: 'python',
    sh: 'bash',
    shell: 'bash',
    zsh: 'bash',
    yml: 'yaml',
    md: 'markdown',
    text: PLAINTEXT_LANGUAGE,
    txt: PLAINTEXT_LANGUAGE,
    plain: PLAINTEXT_LANGUAGE,
    plaintext: PLAINTEXT_LANGUAGE,
  };

  if (aliases[normalized]) {
    return aliases[normalized];
  }

  if (isBundledLanguage(normalized)) {
    return normalized;
  }

  return PLAINTEXT_LANGUAGE;
}

/**
 * Synchronous rehype plugin for Shiki syntax highlighting.
 *
 * Transforms `pre > code` elements to highlighted code using Shiki.
 * If the highlighter is not initialized, code blocks are left as-is.
 *
 * @param options - Plugin options
 * @returns A rehype transformer function
 *
 * @example
 * ```ts
 * import { unified } from 'unified';
 * import { rehypeShikiSync } from './rehype-shiki-sync';
 *
 * const processor = unified()
 *   .use(remarkRehype)
 *   .use(rehypeShikiSync, { theme: 'depict' })
 *   .use(rehypeSanitize, schema)
 *   .use(rehypeStringify);
 * ```
 */
export function rehypeShikiSync(options: RehypeShikiSyncOptions = {}) {
  const { theme = 'depict', defaultLanguage = PLAINTEXT_LANGUAGE } = options;

  return (tree: Root) => {
    const highlighter = getHighlighterSync();

    // If highlighter isn't ready, skip highlighting
    // Code blocks will render as plain text
    if (!highlighter) {
      return;
    }

    visit(tree, 'element', (node, index, parent) => {
      // Only process pre > code patterns
      if (node.tagName !== 'pre') return;
      if (!parent || typeof index !== 'number') return;

      // Find the code child
      const codeChild = node.children.find(
        (child): child is Element => child.type === 'element' && child.tagName === 'code',
      );

      if (!codeChild) return;

      // Extract language and code
      const rawLanguage = extractLanguage(codeChild);
      const language = rawLanguage ? normalizeLanguage(rawLanguage) : defaultLanguage;
      const code = extractText(codeChild);

      // Skip empty code blocks
      if (!code.trim()) return;

      // Skip plaintext - no highlighting needed
      if (language === PLAINTEXT_LANGUAGE) {
        // Just add data-language attribute for styling/accessibility
        if (!node.properties) node.properties = {};
        node.properties['dataLanguage'] = language;
        return;
      }

      try {
        // Generate highlighted HTML (only for bundled languages)
        const highlightedHtml = highlighter.codeToHtml(code, {
          lang: language,
          theme: theme,
        });

        // Parse the HTML into hast nodes
        const highlightedElement = parseShikiHtml(highlightedHtml);

        // Preserve the original data-language for accessibility
        if (!highlightedElement.properties['dataLanguage']) {
          highlightedElement.properties['dataLanguage'] = language;
        }

        // Replace the original pre element with the highlighted one
        parent.children[index] = highlightedElement;
      } catch {
        // If highlighting fails, leave the code block as-is
        // This ensures graceful degradation for unsupported languages
      }
    });
  };
}

export default rehypeShikiSync;
