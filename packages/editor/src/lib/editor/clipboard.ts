/**
 * Custom clipboard behavior for Milkdown (DEP-45).
 *
 * Paste rules:
 * - **Code (VSCode)**: Detect `vscode-editor-data` and insert a fenced code block (with language if available).
 * - **Markdown**: If clipboard provides `text/markdown` or `text/x-markdown`, parse and insert structured content.
 * - **HTML**: Sanitize (DEP-47) then parse and insert.
 * - **Plain text**: Let the default ProseMirror behavior insert as-is.
 *
 * Copy behavior:
 * - Serialize selection to Markdown via Milkdown serializer
 * - Normalize via DEP-35 `normalize()` before writing to the clipboard
 *
 * @module
 */

import { normalize, sanitizeHtml } from '@lostgradient/markdown';
import {
  DOMParser,
  DOMSerializer,
  type Node as ProseMirrorNode,
  type Schema,
  type Slice,
} from 'prosemirror-model';
import { Plugin, PluginKey, TextSelection } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';

import { createLazyProsePlugin } from './milkdown-plugin-runtime.js';

function isVscodeClipboardPayload(value: unknown): value is { mode?: unknown } {
  return value !== null && typeof value === 'object';
}

function normalizeMarkdownSafely(markdown: string): string {
  try {
    return normalize(markdown);
  } catch (error) {
    console.warn('Failed to normalize clipboard markdown:', error);
    return markdown;
  }
}

function getMarkdownFromClipboard(dataTransfer: DataTransfer): string {
  // Prefer the markdown-specific clipboard types.
  const markdown =
    dataTransfer.getData('text/markdown') || dataTransfer.getData('text/x-markdown') || '';
  return markdown;
}

function getLanguageHintFromVscodeClipboard(dataTransfer: DataTransfer): string | undefined {
  const vscodeData = dataTransfer.getData('vscode-editor-data');
  if (!vscodeData) return undefined;

  try {
    const parsed: unknown = JSON.parse(vscodeData);
    return isVscodeClipboardPayload(parsed) && typeof parsed.mode === 'string'
      ? parsed.mode
      : undefined;
  } catch {
    return undefined;
  }
}

function getNodeFromSchema(type: string, schema: Schema) {
  const nodeType = schema.nodes[type];
  if (!nodeType) {
    throw new Error(`Missing ProseMirror node type: ${type}`);
  }

  return nodeType;
}

function isTextOnlySlice(slice: Slice): ProseMirrorNode | false {
  if (slice.content.childCount !== 1) return false;

  const node = slice.content.firstChild;
  return isPlainTextNode(node) || isPlainTextParagraph(node);
}

function isPlainTextNode(node: ProseMirrorNode | null): ProseMirrorNode | false {
  return node?.type.name === 'text' && node.marks.length === 0 ? node : false;
}

function isPlainTextParagraph(node: ProseMirrorNode | null): ProseMirrorNode | false {
  if (node?.type.name !== 'paragraph' || node.childCount !== 1) return false;
  return isPlainTextNode(node.firstChild);
}

function insertVscodePaste(
  view: EditorView,
  clipboardData: DataTransfer,
  schema: Schema,
): boolean | undefined {
  const plainText = clipboardData.getData('text/plain');
  if (!clipboardData.getData('vscode-editor-data') || !plainText) return undefined;
  const language = getLanguageHintFromVscodeClipboard(clipboardData);
  const codeBlockType = getNodeFromSchema('code_block', schema);
  const transaction = view.state.tr;
  transaction.replaceSelectionWith(codeBlockType.create({ language }));
  transaction
    .setSelection(
      TextSelection.near(transaction.doc.resolve(Math.max(0, transaction.selection.from - 2))),
    )
    .insertText(plainText.replace(/\r\n?/g, '\n'));
  view.dispatch(transaction);
  return true;
}

function insertMarkdownPaste(
  view: EditorView,
  markdown: string,
  schema: Schema,
  parser: (value: string) => ProseMirrorNode | string | null | undefined,
): boolean | undefined {
  if (!markdown) return undefined;
  const parsed = parser(markdown);
  if (!parsed || typeof parsed === 'string') {
    view.dispatch(view.state.tr.insertText(markdown.replace(/\r\n?/g, '\n')));
    return true;
  }
  const dom = DOMSerializer.fromSchema(schema).serializeFragment(parsed.content);
  const slice = DOMParser.fromSchema(schema).parseSlice(dom);
  const textOnlyNode = isTextOnlySlice(slice);
  if (textOnlyNode) {
    view.dispatch(view.state.tr.replaceSelectionWith(textOnlyNode, true));
    return true;
  }
  try {
    view.dispatch(view.state.tr.replaceSelection(slice));
    return true;
  } catch {
    return false;
  }
}

function insertHtmlPaste(
  view: EditorView,
  html: string,
  plainText: string,
  schema: Schema,
): boolean | undefined {
  if (!html) return undefined;
  const template = document.createElement('template');
  template.innerHTML = sanitizeHtml(html);
  const dom = template.content.cloneNode(true);
  template.remove();
  const slice = DOMParser.fromSchema(schema).parseSlice(dom);
  const textOnlyNode = isTextOnlySlice(slice);
  if (textOnlyNode) {
    view.dispatch(view.state.tr.replaceSelectionWith(textOnlyNode, true));
    return true;
  }
  try {
    view.dispatch(view.state.tr.replaceSelection(slice));
    return true;
  } catch {
    if (!plainText) return false;
    view.dispatch(view.state.tr.insertText(plainText.replace(/\r\n?/g, '\n')));
    return true;
  }
}

/**
 * Milkdown plugin wrapper for the ProseMirror clipboard plugin.
 */
export const clipboardPlugin = createLazyProsePlugin(async (ctx) => {
  const { editorViewOptionsCtx, parserCtx, schemaCtx, serializerCtx } =
    await import('@milkdown/kit/core');
  const schema = ctx.get(schemaCtx);

  // Ensure editable prop exists (Milkdown issue workaround).
  ctx.update(editorViewOptionsCtx, (previous) => ({
    ...previous,
    editable: previous.editable ?? (() => true),
  }));

  const key = new PluginKey('DEP_45_CLIPBOARD');

  return new Plugin({
    key,
    props: {
      handlePaste: (view, event) => {
        const editable = view.props.editable?.(view.state);
        const { clipboardData } = event;
        if (!editable || !clipboardData) return false;

        const currentNode = view.state.selection.$from.node();
        if (currentNode.type.spec.code) return false;

        const plainText = clipboardData.getData('text/plain');
        const vscodeResult = insertVscodePaste(view, clipboardData, schema);
        if (vscodeResult !== undefined) return vscodeResult;
        const markdown = getMarkdownFromClipboard(clipboardData);
        const markdownResult = insertMarkdownPaste(view, markdown, schema, (value) =>
          ctx.get(parserCtx)(value),
        );
        if (markdownResult !== undefined) return markdownResult;
        const html = clipboardData.getData('text/html');
        return insertHtmlPaste(view, html, plainText, schema) ?? false;
      },

      clipboardTextSerializer: (slice) => {
        const serializer = ctx.get(serializerCtx);

        // Try to serialize as a valid doc node first.
        let doc = schema.topNodeType.createAndFill(undefined, slice.content);

        // If the slice is inline-only (common for partial selections), wrap it in a paragraph.
        if (!doc) {
          const paragraphType = schema.nodes['paragraph'];
          if (paragraphType) {
            const paragraph = paragraphType.createAndFill(undefined, slice.content);
            if (paragraph) {
              doc = schema.topNodeType.createAndFill(undefined, paragraph);
            }
          }
        }

        // Fallback to plain text if we can't build a valid document.
        if (!doc) {
          const plain = slice.content.textBetween(0, slice.content.size, '\n\n');
          return normalizeMarkdownSafely(plain);
        }

        const markdown = serializer(doc);
        return normalizeMarkdownSafely(markdown);
      },
    },
  });
});
