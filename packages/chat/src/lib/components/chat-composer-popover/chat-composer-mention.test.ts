import { describe, expect, test } from 'bun:test';

import {
  deserializeChatComposerMention,
  parseChatComposerMentions,
  serializeChatComposerMention,
} from './chat-composer-mention.ts';

describe('chat composer mentions', () => {
  test('serializes entity labels and URIs as Markdown links', () => {
    expect(serializeChatComposerMention({ label: 'Ada', uri: 'person:ada' })).toBe(
      '[Ada](person:ada)',
    );
    expect(serializeChatComposerMention({ label: 'A[da]', uri: 'person:ada (eng)' })).toBe(
      '[A\\[da\\]](person:ada\\ \\(eng\\))',
    );
    expect(() =>
      serializeChatComposerMention({ label: 'Docs', uri: 'https://example.com' }),
    ).toThrow('requires an absolute non-web entity URI');
  });

  test('serializes and deserializes escaped labels and entity URIs without loss', () => {
    const mention = {
      label: 'Miyuki [design] (owner) \\ notes',
      uri: 'linear:issue/CIN-387 (chat) [draft] \\ 日本語',
    };

    const serialized = serializeChatComposerMention(mention);

    expect(deserializeChatComposerMention(serialized)).toEqual(mention);
  });

  test('projects multiple and adjacent mentions into text with UTF-16 ranges', () => {
    const first = serializeChatComposerMention({ label: 'Ada', uri: 'person:ada' });
    const second = serializeChatComposerMention({ label: '📦 Project', uri: 'linear:project/42' });

    expect(parseChatComposerMentions(`Hi ${first}${second}!`)).toEqual({
      text: 'Hi Ada📦 Project!',
      mentions: [
        { label: 'Ada', uri: 'person:ada', start: 3, end: 6 },
        { label: '📦 Project', uri: 'linear:project/42', start: 6, end: 16 },
      ],
    });
  });

  test('leaves ordinary, image, escaped, malformed, and web links as textarea text', () => {
    const value = [
      '[Docs](https://example.com)',
      '[Email](mailto:hello@example.com)',
      '[Script](javascript:alert(1))',
      '[Data](data:text/plain,hello)',
      '[Relative](./notes)',
      '![Image](asset:logo)',
      '\\[Escaped](person:ada)',
      '[Missing destination](person:ada',
      '[Unescaped space](person:ada lovelace)',
    ].join(' ');

    expect(parseChatComposerMentions(value)).toEqual({ text: value, mentions: [] });
    expect(deserializeChatComposerMention('[Docs](https://example.com)')).toBeNull();
    expect(deserializeChatComposerMention('[Broken](person:ada')).toBeNull();
  });

  test('does not let an unclosed label absorb a later serialized mention', () => {
    expect(parseChatComposerMentions('Before [unfinished [Ada](person:ada)')).toEqual({
      text: 'Before [unfinished Ada',
      mentions: [{ label: 'Ada', uri: 'person:ada', start: 19, end: 22 }],
    });
  });

  test('leaves mention syntax inside inline and fenced code literal', () => {
    const value = '`[Ada](person:ada)` [Ada](person:ada)\n```\n[Ada](person:ada)\n```';

    expect(parseChatComposerMentions(value)).toEqual({
      text: '`[Ada](person:ada)` Ada\n```\n[Ada](person:ada)\n```',
      mentions: [{ label: 'Ada', uri: 'person:ada', start: 20, end: 23 }],
    });

    const mismatchedDelimiter = '`literal `` [Ada](person:ada) `';
    expect(parseChatComposerMentions(mismatchedDelimiter)).toEqual({
      text: mismatchedDelimiter,
      mentions: [],
    });
  });

  test('preserves escaped Markdown characters in labels and destinations', () => {
    expect(parseChatComposerMentions('[A\\]da](person:ada\\(eng\\))')).toEqual({
      text: 'A]da',
      mentions: [{ label: 'A]da', uri: 'person:ada(eng)', start: 0, end: 4 }],
    });

    expect(deserializeChatComposerMention('[Ada](person:ada(eng))')).toEqual({
      label: 'Ada',
      uri: 'person:ada(eng)',
    });
  });
});
