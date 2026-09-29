import { Heading1, Heading2, Heading3, Pilcrow, Quote } from '@lostgradient/cinder';
import type { Ctx } from '@milkdown/kit/ctx';

import type { ActiveBlockType } from '../../../editor/index.ts';
import {
  setHeading,
  setParagraph,
  toggleBlockquote,
  toggleBold,
  toggleBulletList,
  toggleCode,
  toggleItalic,
  toggleOrderedList,
  toggleStrikethrough,
} from '../../../editor/index.ts';
import type { BlockType, BlockTypeOption } from './toolbar-dropdown.svelte';

export const blockTypeOptions: BlockTypeOption[] = [
  { type: 'paragraph', label: 'Paragraph', icon: Pilcrow },
  { type: 'heading1', label: 'Heading 1', icon: Heading1 },
  { type: 'heading2', label: 'Heading 2', icon: Heading2 },
  { type: 'heading3', label: 'Heading 3', icon: Heading3 },
  { type: 'blockquote', label: 'Quote', icon: Quote },
];

export function resolveCurrentBlockType(activeBlockType: ActiveBlockType): BlockType {
  if (activeBlockType.type === 'heading') {
    if (activeBlockType.headingLevel === 1) return 'heading1';
    if (activeBlockType.headingLevel === 2) return 'heading2';
    if (activeBlockType.headingLevel === 3) return 'heading3';
  }
  return activeBlockType.type === 'blockquote' ? 'blockquote' : 'paragraph';
}

type ToolbarCommandHandlers = {
  handleBold: () => void;
  handleItalic: () => void;
  handleCode: () => void;
  handleStrikethrough: () => void;
  handleLink: (event: MouseEvent) => void;
  handleBulletList: () => void;
  handleOrderedList: () => void;
  handleBlockquote: () => void;
  handleBlockTypeChange: (type: BlockType) => void;
};

export function createToolbarCommandHandlers(
  getEditorContext: () => Ctx | null,
  closeFormattingPopover: () => void,
  getOnLinkClick: () => ((triggerElement: HTMLElement) => void) | undefined,
): ToolbarCommandHandlers {
  return {
    handleBold: () => {
      const context = getEditorContext();
      if (context) toggleBold(context);
    },
    handleItalic: () => {
      const context = getEditorContext();
      if (context) toggleItalic(context);
    },
    handleCode: () => {
      const context = getEditorContext();
      if (context) toggleCode(context);
    },
    handleStrikethrough: () => {
      const context = getEditorContext();
      if (context) toggleStrikethrough(context);
    },
    handleLink: (event) => {
      closeFormattingPopover();
      if (event.currentTarget instanceof HTMLElement) getOnLinkClick()?.(event.currentTarget);
    },
    handleBulletList: () => {
      const context = getEditorContext();
      if (context) toggleBulletList(context);
    },
    handleOrderedList: () => {
      const context = getEditorContext();
      if (context) toggleOrderedList(context);
    },
    handleBlockquote: () => {
      const context = getEditorContext();
      if (context) toggleBlockquote(context);
    },
    handleBlockTypeChange: (type) => {
      const context = getEditorContext();
      if (!context) return;
      if (type === 'paragraph') setParagraph(context);
      else if (type === 'heading1') setHeading(context, 1);
      else if (type === 'heading2') setHeading(context, 2);
      else if (type === 'heading3') setHeading(context, 3);
      else toggleBlockquote(context);
    },
  };
}
