import type { CommandMenuTriggerMatch } from './command-menu.types.ts';

export type DetectCommandMenuTriggerOptions = {
  text: string;
  selectionStart: number;
  selectionEnd: number;
  triggerChar?: string;
};

function isSingleNonWhitespaceCodePoint(value: string): boolean {
  return Array.from(value).length === 1 && !/\s/u.test(value);
}

export function detectTrigger({
  text,
  selectionStart,
  selectionEnd,
  triggerChar = '/',
}: DetectCommandMenuTriggerOptions): CommandMenuTriggerMatch | null {
  if (selectionStart !== selectionEnd) return null;
  if (!isSingleNonWhitespaceCodePoint(triggerChar)) return null;

  const caretIndex = Math.max(0, Math.min(selectionEnd, text.length));
  const triggerStart = text.lastIndexOf(triggerChar, caretIndex - 1);
  if (triggerStart < 0) return null;

  const beforeTrigger = triggerStart === 0 ? '' : text[triggerStart - 1];
  if (beforeTrigger && !/\s/u.test(beforeTrigger)) return null;

  const query = text.slice(triggerStart + triggerChar.length, caretIndex);
  if (/\s/u.test(query)) return null;

  return {
    active: true,
    query,
    start: triggerStart,
    end: caretIndex,
  };
}
