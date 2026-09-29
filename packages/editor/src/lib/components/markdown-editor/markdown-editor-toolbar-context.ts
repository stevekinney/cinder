/**
 * The `ToolbarContext` MarkdownEditor hands to toolbar snippets and to
 * `onToolbarContextChange`.
 *
 * Formatting only applies to the rich editor. In source and preview mode the
 * context is inactive even while a rich editor is retained behind the preview,
 * so an externally hosted toolbar cannot format a document the user cannot see.
 */

import type { Ctx } from '@milkdown/kit/ctx';

import type { ActiveBlockType, ActiveMarks } from '../../editor/index.ts';
import type { EditorMode, ToolbarContext } from './markdown-editor.types.ts';

const INACTIVE_MARKS: ActiveMarks = Object.freeze({
  bold: false,
  italic: false,
  code: false,
  strikethrough: false,
  link: false,
});

const PARAGRAPH_BLOCK: ActiveBlockType = Object.freeze({ type: 'paragraph' });

function doNothing(): void {}

/** The rich editor's live formatting state. */
export interface RichToolbarState {
  editorContext: Ctx | null;
  activeMarks: ActiveMarks;
  activeBlockType: ActiveBlockType;
  canUndo: boolean;
  canRedo: boolean;
  linkPopoverOpen: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onLinkClick: (triggerElement: HTMLElement) => void;
}

export interface ToolbarContextInput {
  mode: EditorMode;
  /** The caller's `readonly` flag, reported unchanged. */
  readonly: boolean;
  rich: RichToolbarState;
  onModeChange: (nextMode: EditorMode) => void;
}

/** Build the context for `mode`, inactive outside the rich editor. */
export function buildToolbarContext({
  mode,
  readonly,
  rich,
  onModeChange,
}: ToolbarContextInput): ToolbarContext {
  if (mode !== 'wysiwyg') {
    return {
      editorContext: null,
      activeMarks: INACTIVE_MARKS,
      activeBlockType: PARAGRAPH_BLOCK,
      canUndo: false,
      canRedo: false,
      readonly,
      mode,
      canEdit: false,
      onModeChange,
      onUndo: doNothing,
      onRedo: doNothing,
      onLinkClick: doNothing,
      linkPopoverOpen: false,
    };
  }
  return {
    ...rich,
    readonly,
    mode,
    canEdit: !readonly && rich.editorContext !== null,
    onModeChange,
  };
}
