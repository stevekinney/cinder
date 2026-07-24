import { highlightJson } from '../../utilities/json-highlight.ts';

export type JsonLint = {
  message: string;
  position: number;
};

function lintJson(value: string): JsonLint | undefined {
  try {
    JSON.parse(value);
    return undefined;
  } catch (error) {
    const message = error instanceof SyntaxError ? error.message : 'Enter valid JSON.';
    const position = Number(message.match(/position (\d+)/i)?.[1] ?? value.length);
    return { message: 'Enter valid JSON.', position };
  }
}

export function enhanceJson(value: string): { html: string; lint: JsonLint | undefined } {
  const lint = lintJson(value);
  if (!lint) return { html: highlightJson(value), lint };

  const position = Math.min(lint.position, value.length);
  const escape = (text: string) =>
    text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  const before = escape(value.slice(0, position));
  const character = escape(value[position] ?? ' ');
  const after = escape(value.slice(position + 1));
  return {
    html: `<code class="cinder-json"><span class="cinder-json-lint">${before}${character}</span>${after}</code>`,
    lint,
  };
}
