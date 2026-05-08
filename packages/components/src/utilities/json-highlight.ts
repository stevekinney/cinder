/**
 * Hand-rolled JSON tokenizer for inline syntax highlighting.
 *
 * Parses the input first with `JSON.parse` to confirm it is well-formed JSON;
 * non-JSON input falls through to plain (escaped) text. When parsing succeeds,
 * walks the original source string with a small state machine and wraps each
 * token in a `<span class="cinder-json-token cinder-json-token-{kind}">`.
 *
 * **HTML-safety invariant.** Every byte of the input is HTML-escaped before
 * being placed in the output. Token spans are constructed from a fixed set of
 * class names plus escaped text. The output is therefore safe to render via
 * Svelte's `{@html}`. Future maintainers must keep the escape step — do not
 * route raw input into the output.
 *
 * Returns a `<code class="cinder-json">…</code>` snippet only. The caller wraps
 * it in `<pre>` so headed and headerless code blocks share container styling.
 */

const KEYWORD_NULL = 'null';
const KEYWORD_TRUE = 'true';
const KEYWORD_FALSE = 'false';

// Only escape characters that are syntactically meaningful in HTML *text*
// content. The double-quote needs escaping only inside attribute values, and
// every quote in our output sits inside text nodes — escaping it would change
// what users see when copying the rendered string.
function escapeHtml(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function span(kind: string, raw: string): string {
  return `<span class="cinder-json-token cinder-json-token-${kind}">${escapeHtml(raw)}</span>`;
}

function plainCode(raw: string): string {
  return `<code class="cinder-json">${escapeHtml(raw)}</code>`;
}

/**
 * Read a JSON string token starting at `source[index]` (which is `"`).
 * Returns the literal source slice including the surrounding quotes.
 */
function readStringLiteral(source: string, startIndex: number): string {
  let index = startIndex + 1;
  while (index < source.length) {
    const character = source[index];
    if (character === '\\') {
      index += 2;
      continue;
    }
    if (character === '"') {
      return source.slice(startIndex, index + 1);
    }
    index += 1;
  }
  // JSON.parse already validated input, so this branch is unreachable for
  // well-formed JSON. Return the rest of the source as a defensive fallback.
  return source.slice(startIndex);
}

/**
 * Read a JSON number token starting at `source[startIndex]`. Numbers consist of
 * an optional minus, integer digits, an optional fractional part, and an
 * optional exponent.
 */
function readNumberLiteral(source: string, startIndex: number): string {
  const numberPattern = /-?(?:\d+)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
  numberPattern.lastIndex = startIndex;
  const match = numberPattern.exec(source);
  return match?.[0] ?? source[startIndex] ?? '';
}

/**
 * Tokenize a well-formed JSON source string into highlighted markup.
 * Caller has already verified `JSON.parse(source)` succeeds.
 */
function tokenize(source: string): string {
  let output = '';
  let index = 0;
  let pendingKey = false; // tracks whether the next string is an object key

  while (index < source.length) {
    const character = source[index];

    if (character === undefined) break;

    if (character === ' ' || character === '\t' || character === '\n' || character === '\r') {
      output += escapeHtml(character);
      index += 1;
      continue;
    }

    if (character === '{') {
      output += span('punctuation', '{');
      pendingKey = true;
      index += 1;
      continue;
    }

    if (character === '}' || character === ']') {
      output += span('punctuation', character);
      index += 1;
      continue;
    }

    if (character === '[') {
      output += span('punctuation', '[');
      pendingKey = false;
      index += 1;
      continue;
    }

    if (character === ',') {
      output += span('punctuation', ',');
      // The preceding context determines whether the next string is a key.
      // We can't know without looking back; instead, re-set pendingKey based on
      // the most recent unmatched opener. A cheap proxy: scan backward for the
      // nearest `{` or `[` ignoring nested structures already emitted as spans.
      pendingKey = mostRecentOpenerIsObject(source, index);
      index += 1;
      continue;
    }

    if (character === ':') {
      output += span('punctuation', ':');
      pendingKey = false; // values follow the colon
      index += 1;
      continue;
    }

    if (character === '"') {
      const literal = readStringLiteral(source, index);
      output += span(pendingKey ? 'key' : 'string', literal);
      index += literal.length;
      // After a key string, the next non-whitespace must be `:` and then a value.
      // After a value string, the next non-whitespace is `,` or a closing bracket.
      // pendingKey will be reset by `:` (to false) and by `,` (recomputed).
      continue;
    }

    if (character === '-' || (character >= '0' && character <= '9')) {
      const literal = readNumberLiteral(source, index);
      output += span('number', literal);
      index += literal.length;
      continue;
    }

    if (source.startsWith(KEYWORD_TRUE, index)) {
      output += span('boolean', KEYWORD_TRUE);
      index += KEYWORD_TRUE.length;
      continue;
    }

    if (source.startsWith(KEYWORD_FALSE, index)) {
      output += span('boolean', KEYWORD_FALSE);
      index += KEYWORD_FALSE.length;
      continue;
    }

    if (source.startsWith(KEYWORD_NULL, index)) {
      output += span('null', KEYWORD_NULL);
      index += KEYWORD_NULL.length;
      continue;
    }

    // Defensive: well-formed JSON has no other tokens. Emit the character
    // escaped so we never mis-render unexpected input.
    output += escapeHtml(character);
    index += 1;
  }

  return `<code class="cinder-json">${output}</code>`;
}

/**
 * Walk backward from `index` to find the nearest unmatched `{` or `[` and
 * return true when it's `{` (object context where strings are keys).
 */
function mostRecentOpenerIsObject(source: string, index: number): boolean {
  let depth = 0;
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const character = source[cursor];
    if (character === '"') {
      // skip over the string literal we just passed
      cursor -= 1;
      while (cursor >= 0 && source[cursor] !== '"') {
        cursor -= 1;
      }
      continue;
    }
    if (character === '}' || character === ']') {
      depth += 1;
      continue;
    }
    if (character === '{') {
      if (depth === 0) return true;
      depth -= 1;
      continue;
    }
    if (character === '[') {
      if (depth === 0) return false;
      depth -= 1;
      continue;
    }
  }
  return false;
}

/**
 * Highlight a JSON value as syntax-colored HTML. Non-JSON input is returned as
 * a plain `<code>` with the input HTML-escaped, so the caller can wrap either
 * result in the same `<pre>` for visual parity.
 */
export function highlightJson(value: string): string {
  try {
    JSON.parse(value);
  } catch {
    return plainCode(value);
  }
  return tokenize(value);
}
