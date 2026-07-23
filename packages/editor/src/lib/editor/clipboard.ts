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

import { normalize } from '@lostgradient/markdown/pipeline';
import { sanitizeHtml } from '@lostgradient/markdown/templates/sanitize-html';
import {
  DOMParser,
  DOMSerializer,
  type Node as ProseMirrorNode,
  type Schema,
  type Slice,
} from 'prosemirror-model';
import { Plugin, PluginKey, TextSelection } from 'prosemirror-state';

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
  if (node?.type.name === 'text' && node.marks.length === 0) return node;

  if (node?.type.name === 'paragraph' && node.childCount === 1) {
    const firstChild = node.firstChild;
    if (firstChild?.type.name === 'text' && firstChild.marks.length === 0) return firstChild;
  }

  return false;
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

        // 1) VSCode paste → code block
        const vscodeEditorData = clipboardData.getData('vscode-editor-data');
        if (vscodeEditorData && plainText) {
          const language = getLanguageHintFromVscodeClipboard(clipboardData);
          const codeBlockType = getNodeFromSchema('code_block', schema);

          const transaction = view.state.tr;

          // Create a code block node, with a language hint if available.
          transaction.replaceSelectionWith(codeBlockType.create({ language }));
          transaction
            .setSelection(
              TextSelection.near(
                transaction.doc.resolve(Math.max(0, transaction.selection.from - 2)),
              ),
            )
            .insertText(plainText.replace(/\r\n?/g, '\n'));

          view.dispatch(transaction);
          return true;
        }

        // 2) Markdown clipboard type → parse and insert
        const markdown = getMarkdownFromClipboard(clipboardData);
        if (markdown) {
          const parser = ctx.get(parserCtx);
          const parsed = parser(markdown);
          if (!parsed || typeof parsed === 'string') {
            // If parsing fails, fall back to inserting as plain text.
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

        // 3) HTML → sanitize then parse and insert
        const html = clipboardData.getData('text/html');
        if (html) {
          const sanitizedHtml = sanitizeHtml(html);
          const template = document.createElement('template');
          template.innerHTML = sanitizedHtml;
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
            // If HTML parsing fails, fall back to plain text (safe).
            if (plainText) {
              view.dispatch(view.state.tr.insertText(plainText.replace(/\r\n?/g, '\n')));
              return true;
            }
            return false;
          }
        }

        // 4) Plain text → default ProseMirror behavior (insert as-is)
        return false;
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
