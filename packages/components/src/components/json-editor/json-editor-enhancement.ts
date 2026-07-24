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

function escapeHtml(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

export function enhanceJson(value: string): { html: string; lint: JsonLint | undefined } {
  const lint = lintJson(value);
  if (!lint) return { html: highlightJson(value), lint };

  const position = Math.min(lint.position, value.length);
  const before = escapeHtml(value.slice(0, position));
  const character = escapeHtml(value[position] ?? ' ');
  const after = escapeHtml(value.slice(position + 1));
  return {
    html: `<code class="cinder-json"><span class="cinder-json-lint">${before}${character}</span>${after}</code>`,
    lint,
  };
}
