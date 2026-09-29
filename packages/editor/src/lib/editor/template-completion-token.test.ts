/**
 * COR-526: in-progress token detection over same-mark runs, and the range an
 * accepted suggestion replaces.
 */

import { describe, expect, it } from 'bun:test';
import { detectTokenQuery } from './template-completion-query.js';
import {
  createStateWithInline,
  createStateWithText,
  schema,
} from './template-completion-test-utilities.js';

const strong = schema.mark('strong');
const inlineCode = schema.mark('inlineCode');
const link = schema.mark('link', { href: 'https://example.com/{{target}}' });

describe('detectTokenQuery token range', () => {
  it('covers a complete token when the caret is inside its body', () => {
    // "{{user.na|me}}" with the caret after "na".
    const result = detectTokenQuery(createStateWithText('{{user.name}}', 9));

    expect(result?.query).toBe('user.na');
    expect(result?.tokenFrom).toBe(1);
    expect(result?.tokenTo).toBe(1 + '{{user.name}}'.length);
  });

  it('covers the same complete token when the caret is right after the opener', () => {
    const result = detectTokenQuery(createStateWithText('{{user.name}}', 2));

    expect(result?.query).toBe('');
    expect(result?.tokenFrom).toBe(1);
    expect(result?.tokenTo).toBe(1 + '{{user.name}}'.length);
  });

  it('stops at the first token when several complete tokens share a block', () => {
    const result = detectTokenQuery(createStateWithText('{{input.name}} and {{output.result}}', 5));

    expect(result?.tokenFrom).toBe(1);
    expect(result?.tokenTo).toBe(15);
  });

  it('finds the range of the second complete token in a block', () => {
    // The second `{{` is at text offset 19 (document position 20).
    const result = detectTokenQuery(
      createStateWithText('{{input.name}} and {{output.result}}', 24),
    );

    expect(result?.query).toBe('out');
    expect(result?.tokenFrom).toBe(20);
    expect(result?.tokenTo).toBe(37);
  });

  it('ends an unclosed token after the path characters following the caret', () => {
    // "{{user.na|me and more" — only "me" belongs to the token.
    const result = detectTokenQuery(createStateWithText('{{user.name and more', 9));

    expect(result?.tokenTo).toBe(1 + '{{user.name'.length);
  });

  it('ends an unclosed token at the caret when nothing follows it', () => {
    const result = detectTokenQuery(createStateWithText('say {{us', 8));

    expect(result?.tokenFrom).toBe(5);
    expect(result?.tokenTo).toBe(9);
  });

  it('does not open after the closing delimiter or between the closing braces', () => {
    expect(detectTokenQuery(createStateWithText('{{name}}', 8))).toBeNull();
    expect(detectTokenQuery(createStateWithText('{{name}}', 7))).toBeNull();
  });

  it('treats an escaped opening delimiter as literal text', () => {
    expect(detectTokenQuery(createStateWithText('\\{{name', 7))).toBeNull();
  });

  it('does not open for triple braces', () => {
    expect(detectTokenQuery(createStateWithText('{{{name', 7))).toBeNull();
  });
});

describe('detectTokenQuery eligibility', () => {
  it('opens inside a token that sits entirely in one marked run and keeps its marks', () => {
    const state = createStateWithInline([schema.text('{{na', [strong])], 5);
    const result = detectTokenQuery(state);

    expect(result?.query).toBe('na');
    expect(result?.marks.map((mark) => mark.type.name)).toEqual(['strong']);
  });

  it('does not open when the token crosses a mark boundary', () => {
    // "{{" plain, then "na" bold: the run before the caret holds no opener.
    const state = createStateWithInline([schema.text('{{'), schema.text('na', [strong])], 5);

    expect(detectTokenQuery(state)).toBeNull();
  });

  it('does not open in inline code', () => {
    const state = createStateWithInline([schema.text('{{na', [inlineCode])], 5);

    expect(detectTokenQuery(state)).toBeNull();
  });

  it('does not open in a code block', () => {
    const state = createStateWithInline([schema.text('{{na')], 5, 'code_block');

    expect(detectTokenQuery(state)).toBeNull();
  });

  it('does not open across a hard break', () => {
    const state = createStateWithInline(
      [schema.text('{{'), schema.node('hard_break'), schema.text('na')],
      6,
    );

    expect(detectTokenQuery(state)).toBeNull();
  });

  it('opens in link label text; the link target is never scanned', () => {
    const state = createStateWithInline([schema.text('see {{na', [link])], 9);

    expect(detectTokenQuery(state)?.query).toBe('na');
  });
});
