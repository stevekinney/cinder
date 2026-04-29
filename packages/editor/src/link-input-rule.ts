/**
 * Input rule for converting Markdown link syntax into a link mark.
 */

import { schemaCtx } from '@milkdown/kit/core';
import { InputRule } from '@milkdown/kit/prose/inputrules';
import { $inputRule } from '@milkdown/kit/utils';

const linkInputRuleRegex = /(^|[^!])\[([^\]]+)\]\(([^)\s]+)\)$/;

export const linkInputRulePlugin = $inputRule((ctx) => {
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
