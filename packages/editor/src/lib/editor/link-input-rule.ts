/**
 * Input rule for converting Markdown link syntax into a link mark.
 */

import { InputRule } from 'prosemirror-inputrules';

import { createLazyInputRule } from './milkdown-plugin-runtime.js';

const linkInputRuleRegex = /(^|[^!])\[([^\]]+)\]\(([^)\s]+)\)$/;

export const linkInputRulePlugin = createLazyInputRule(async (ctx) => {
  const { schemaCtx } = await import('@milkdown/kit/core');
  const schema = ctx.get(schemaCtx);
  const linkMark = schema.marks['link'];

  if (!linkMark) {
    return new InputRule(/$^/, () => null);
  }

  return new InputRule(
    linkInputRuleRegex,
    (state, match, start, end) => {
      const prefix = match[1] ?? '';
      const text = match[2];
      const url = match[3];

      if (!text || !url) return null;

      const startPos = start + prefix.length;
      const mark = linkMark.create({ href: url });
      const baseMarks = state.storedMarks ?? state.selection.$from.marks();
      const marks = mark.addToSet(baseMarks);

      return state.tr.replaceWith(startPos, end, state.schema.text(text, marks));
    },
    { inCodeMark: false },
  );
});
