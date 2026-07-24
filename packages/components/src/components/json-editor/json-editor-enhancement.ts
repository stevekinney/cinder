import { highlightJsonValidated } from '../../utilities/json-highlight.ts';

export type JsonLint = {
  position: number;
};

function lintJson(value: string, validated: boolean): JsonLint | undefined {
  if (validated) return undefined;
  try {
    JSON.parse(value);
    return undefined;
  } catch (error) {
    const message = error instanceof SyntaxError ? error.message : '';
    const positionMatch = message.match(/position (\d+)/i);
    const lineColumnMatch = message.match(/line\s+(\d+)\s+column\s+(\d+)/i);
    let position = Number(positionMatch?.[1] ?? value.length);
    if (!positionMatch && lineColumnMatch) {
      const line = Number(lineColumnMatch[1]);
      const column = Number(lineColumnMatch[2]);
      const lines = value.split('\n');
      position =
        lines.slice(0, line - 1).reduce((offset, current) => offset + current.length + 1, 0) +
        column;
    }
    return { position };
  }
}

function escapeHtml(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

export function enhanceJson(
  value: string,
  validated = false,
): { html: string; lint: JsonLint | undefined } {
  const lint = lintJson(value, validated);
  if (!lint) return { html: highlightJsonValidated(value), lint };

  const position = Math.min(lint.position, value.length);
  const before = escapeHtml(value.slice(0, position));
  const character = escapeHtml(value[position] ?? '\u00a0');
  const after = escapeHtml(value.slice(position + 1));
  return {
    html: `<code class="cinder-json">${before}<span class="cinder-json-lint">${character}</span>${after}</code>`,
    lint,
  };
}
