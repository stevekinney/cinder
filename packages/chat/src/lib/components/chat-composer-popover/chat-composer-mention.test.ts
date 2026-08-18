import { describe, expect, test } from 'bun:test';

import { makeScanMetadata } from './chat-composer-mention-scan.ts';
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
    expect(serializeChatComposerMention({ label: 'Ada', uri: 'person:<ada>' })).toBe(
      '[Ada](person:\\<ada\\>)',
    );
    expect(() =>
      serializeChatComposerMention({ label: 'Docs', uri: 'https://example.com' }),
    ).toThrow('requires an absolute non-web entity URI');
    expect(() => serializeChatComposerMention({ label: '', uri: 'person:ada' })).toThrow(
      'requires a non-empty label',
    );
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
      '[Socket](wss://example.com/chat)',
      '[Relative](./notes)',
      '[Docs](https://example.com "[Ada](person:ada)")',
      '[Docs](<https://example.com/a\\>b> "[Ada](person:ada)")',
      '[Docs](https://example.com "a ) [Ada](person:ada)")',
      '[Docs](https://example.com "a \\" [Ada](person:ada)")',
      '[Escaped](https://example.com\\) "[Ada](person:ada)")',
      '![Image](asset:logo)',
      '\\[Escaped](person:ada)',
      '[Missing destination](person:ada',
      '[Unescaped space](person:ada lovelace)',
    ].join(' ');

    expect(parseChatComposerMentions(value)).toEqual({ text: value, mentions: [] });
    expect(deserializeChatComposerMention('[Docs](https://example.com)')).toBeNull();
    expect(deserializeChatComposerMention('[Broken](person:ada')).toBeNull();
    expect(deserializeChatComposerMention('[](person:ada)')).toBeNull();
    expect(parseChatComposerMentions('[C:\\new](person:folder)')).toEqual({
      text: 'C:\\new',
      mentions: [{ label: 'C:\\new', uri: 'person:folder', start: 0, end: 6 }],
    });
    expect(parseChatComposerMentions('![unfinished [Ada](person:ada)')).toEqual({
      text: '![unfinished Ada',
      mentions: [{ label: 'Ada', uri: 'person:ada', start: 13, end: 16 }],
    });
    const malformedTitle = '[Docs](https://x "[Ada](person:ada)" trailing)';
    const malformedTitleText = '[Docs](https://x "Ada" trailing)';
    const malformedTitleMentionStart = malformedTitleText.indexOf('Ada');
    expect(parseChatComposerMentions(malformedTitle)).toEqual({
      text: malformedTitleText,
      mentions: [
        {
          label: 'Ada',
          uri: 'person:ada',
          start: malformedTitleMentionStart,
          end: malformedTitleMentionStart + 3,
        },
      ],
    });
    for (const malformedAngleDestination of [
      '[Docs](<https://x\n[Ada](person:ada)>',
      '[Docs](<https://x<[Ada](person:ada)>)',
      '[Docs](<https://x [Ada](person:ada)',
      '[Docs](https://x (title\n[Ada](person:ada))',
    ]) {
      expect(parseChatComposerMentions(malformedAngleDestination).mentions).toEqual([
        expect.objectContaining({ label: 'Ada', uri: 'person:ada' }),
      ]);
    }
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
    expect(parseChatComposerMentions('`[Ada](person:ada)\n\n`')).toEqual({
      text: '`Ada\n\n`',
      mentions: [{ label: 'Ada', uri: 'person:ada', start: 1, end: 4 }],
    });

    expect(parseChatComposerMentions('```\ncode\n```\n[Ada](person:ada)')).toEqual({
      text: '```\ncode\n```\nAda',
      mentions: [{ label: 'Ada', uri: 'person:ada', start: 13, end: 16 }],
    });

    expect(parseChatComposerMentions('```code``` [Ada](person:ada)')).toEqual({
      text: '```code``` Ada',
      mentions: [{ label: 'Ada', uri: 'person:ada', start: 11, end: 14 }],
    });

    expect(parseChatComposerMentions('`unfinished [Ada](person:ada)')).toEqual({
      text: '`unfinished Ada',
      mentions: [{ label: 'Ada', uri: 'person:ada', start: 12, end: 15 }],
    });

    expect(parseChatComposerMentions('`[Ada](person:ada)\\`')).toEqual({
      text: '`[Ada](person:ada)\\`',
      mentions: [],
    });

    expect(parseChatComposerMentions('    [Ada](person:ada)')).toEqual({
      text: '    [Ada](person:ada)',
      mentions: [],
    });

    expect(parseChatComposerMentions('Intro\n    [Ada](person:ada)')).toEqual({
      text: 'Intro\n    Ada',
      mentions: [{ label: 'Ada', uri: 'person:ada', start: 10, end: 13 }],
    });

    expect(parseChatComposerMentions('\\`[Ada](person:ada)\\`')).toEqual({
      text: '\\`Ada\\`',
      mentions: [{ label: 'Ada', uri: 'person:ada', start: 2, end: 5 }],
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

  test('leaves reference definition and math content literal', () => {
    const value = '[ref]: https://example.com "[Ada](person:ada)"\n$$\n[Ada](person:ada)\n$$';

    expect(parseChatComposerMentions(value)).toEqual({ text: value, mentions: [] });
    const indented = '   [ref]: https://example.com "[Ada](person:ada)"';
    expect(parseChatComposerMentions(indented)).toEqual({ text: indented, mentions: [] });
    expect(parseChatComposerMentions('[note]: this is [Ada](person:ada)')).toEqual({
      text: '[note]: this is Ada',
      mentions: [{ label: 'Ada', uri: 'person:ada', start: 16, end: 19 }],
    });
    expect(parseChatComposerMentions('[^note]: [Ada](person:ada)')).toEqual({
      text: '[^note]: Ada',
      mentions: [{ label: 'Ada', uri: 'person:ada', start: 9, end: 12 }],
    });
    for (const invalidLabel of ['[]: /url "[Ada](person:ada)"', '[ ]: /url "[Ada](person:ada)"']) {
      expect(parseChatComposerMentions(invalidLabel).mentions).toEqual([
        expect.objectContaining({ label: 'Ada', uri: 'person:ada' }),
      ]);
    }
    const angleDestination = '[ref]: <person:a\\>da> "[Ada](person:ada)"';
    expect(parseChatComposerMentions(angleDestination)).toEqual({
      text: angleDestination,
      mentions: [],
    });
    const multilineTitle = '[ref]: /url\n  "[Ada](person:ada)"\n[Ada](person:real)';
    const multilineTitleText = '[ref]: /url\n  "[Ada](person:ada)"\nAda';
    const visibleMentionStart = multilineTitleText.lastIndexOf('Ada');
    expect(parseChatComposerMentions(multilineTitle)).toEqual({
      text: multilineTitleText,
      mentions: [
        {
          label: 'Ada',
          uri: 'person:real',
          start: visibleMentionStart,
          end: visibleMentionStart + 3,
        },
      ],
    });
    expect(parseChatComposerMentions('[ref]: /url\n  "[Ada](person:ada)" trailing')).toEqual({
      text: '[ref]: /url\n  "Ada" trailing',
      mentions: [{ label: 'Ada', uri: 'person:ada', start: 15, end: 18 }],
    });
    expect(parseChatComposerMentions('[ref]: <broken [Ada](person:ada)')).toEqual({
      text: '[ref]: <broken Ada',
      mentions: [{ label: 'Ada', uri: 'person:ada', start: 15, end: 18 }],
    });
    const parenthesizedDestination = '[ref]: person:ada(foo) "[Ada](person:ada)"';
    expect(parseChatComposerMentions(parenthesizedDestination)).toEqual({
      text: parenthesizedDestination,
      mentions: [],
    });
    expect(parseChatComposerMentions('[ref]: person:ada( [Ada](person:ada)')).toEqual({
      text: '[ref]: person:ada( Ada',
      mentions: [{ label: 'Ada', uri: 'person:ada', start: 19, end: 22 }],
    });
    expect(parseChatComposerMentions('[ref]: person:ada) [Ada](person:ada)')).toEqual({
      text: '[ref]: person:ada) Ada',
      mentions: [{ label: 'Ada', uri: 'person:ada', start: 19, end: 22 }],
    });
    expect(parseChatComposerMentions('$$$literal')).toEqual({ text: '$$$literal', mentions: [] });
    expect(parseChatComposerMentions('\\$[Ada](person:ada)\\$')).toEqual({
      text: '\\$Ada\\$',
      mentions: [{ label: 'Ada', uri: 'person:ada', start: 2, end: 5 }],
    });
  });

  test('does not rescan malformed link starts to the end of the input', () => {
    const value = '[x]('.repeat(10_000);

    expect(parseChatComposerMentions(value)).toEqual({ text: value, mentions: [] });
  });

  test('handles delimiter-heavy input with bounded forward scans', () => {
    const value = `${'`'.repeat(100_000)}\n${'$'.repeat(100_000)}\n${'$5 '.repeat(25_000)}\n${' ~'.repeat(25_000)}\n${'<a'.repeat(25_000)}`;

    expect(parseChatComposerMentions(value)).toEqual({ text: value, mentions: [] });
  });

  test('keeps per-character scan metadata bounded', () => {
    const value = `${'plain text '.repeat(10_000)}\n\`code\` $math$`;
    const metadata = makeScanMetadata(value);

    expect(metadata.escaped.length).toBe(value.length);
    expect(metadata.lineStarts.length).toBe(value.length);
    expect(metadata.containerStarts.size).toBe(2);
    expect(metadata.codeSpanEnds.size).toBe(1);
    expect(metadata.mathEnds.size).toBe(1);
  });

  test('keeps Markdown block constructs literal across containers and continuations', () => {
    const value =
      'Intro\n    [Ada](person:ada)\n    continuation\n\n```\n[Ada](person:ada)\n```\n[Ada](person:real)';
    expect(parseChatComposerMentions(value)).toEqual({
      text: 'Intro\n    Ada\n    continuation\n\n```\n[Ada](person:ada)\n```\nAda',
      mentions: [
        { label: 'Ada', uri: 'person:ada', start: 10, end: 13 },
        { label: 'Ada', uri: 'person:real', start: 58, end: 61 },
      ],
    });

    const container = '> ```\n> [Ada](person:ada)\n> ```\n> [Ada](person:real)';
    expect(parseChatComposerMentions(container).mentions).toEqual([
      { label: 'Ada', uri: 'person:real', start: 34, end: 37 },
    ]);

    expect(
      parseChatComposerMentions('- ```\n- [Ada](person:ada)\n- ```\n- [Ada](person:real)').mentions,
    ).toEqual([{ label: 'Ada', uri: 'person:real', start: 34, end: 37 }]);
    expect(parseChatComposerMentions('1. ```\n1. [Ada](person:ada)\n1. ```').mentions).toEqual([]);
    expect(
      parseChatComposerMentions('>    ```\n>    [Ada](person:ada)\n>    ```').mentions,
    ).toEqual([]);
    expect(parseChatComposerMentions('>     ```\n> [Ada](person:ada)').mentions).toEqual([
      { label: 'Ada', uri: 'person:ada', start: 12, end: 15 },
    ]);
    expect(parseChatComposerMentions('>     [Ada](person:ada)')).toEqual({
      text: '>     [Ada](person:ada)',
      mentions: [],
    });
    expect(parseChatComposerMentions('> ```\n```\n[Ada](person:ada)\n> ```').mentions).toEqual([]);
    expect(
      parseChatComposerMentions('```\n    ```\n[Ada](person:inside)\n```\n[Ada](person:outside)'),
    ).toEqual({
      text: '```\n    ```\n[Ada](person:inside)\n```\nAda',
      mentions: [{ label: 'Ada', uri: 'person:outside', start: 37, end: 40 }],
    });
    expect(parseChatComposerMentions('text ``` [Ada](person:ada)').mentions).toEqual([
      { label: 'Ada', uri: 'person:ada', start: 9, end: 12 },
    ]);
    expect(parseChatComposerMentions('-~~~\n\n[Ada](person:ada)')).toEqual({
      text: '-~~~\n\nAda',
      mentions: [{ label: 'Ada', uri: 'person:ada', start: 6, end: 9 }],
    });
    expect(parseChatComposerMentions('    code\r\r[Ada](person:ada)')).toEqual({
      text: '    code\r\rAda',
      mentions: [{ label: 'Ada', uri: 'person:ada', start: 10, end: 13 }],
    });
  });

  test('distinguishes currency, math, references, and raw HTML', () => {
    expect(parseChatComposerMentions('$5 [Ada](person:ada) $10')).toEqual({
      text: '$5 Ada $10',
      mentions: [{ label: 'Ada', uri: 'person:ada', start: 3, end: 6 }],
    });
    expect(parseChatComposerMentions('$[Ada](person:ada)+2$')).toEqual({
      text: '$[Ada](person:ada)+2$',
      mentions: [],
    });
    const raw =
      '<!-- [Ada](person:comment) -->\n<div>\n[Ada](person:block)\n</div>\n\n[Ada](person:real)';
    expect(parseChatComposerMentions(raw)).toEqual({
      text: raw.slice(0, raw.lastIndexOf('[Ada]')) + 'Ada',
      mentions: [{ label: 'Ada', uri: 'person:real', start: 65, end: 68 }],
    });
    expect(parseChatComposerMentions('<!-- [Ada](person:comment)')).toEqual({
      text: '<!-- [Ada](person:comment)',
      mentions: [],
    });
    expect(parseChatComposerMentions('Intro <!-- [Ada](person:ada)')).toEqual({
      text: 'Intro <!-- Ada',
      mentions: [{ label: 'Ada', uri: 'person:ada', start: 11, end: 14 }],
    });
    expect(parseChatComposerMentions('<div>\n[Ada](person:block)\n</div')).toEqual({
      text: '<div>\n[Ada](person:block)\n</div',
      mentions: [],
    });
    expect(parseChatComposerMentions('<div>\n[Ada](person:block)')).toEqual({
      text: '<div>\n[Ada](person:block)',
      mentions: [],
    });
    expect(parseChatComposerMentions('> <div>\n> [Ada](person:block)\n>')).toEqual({
      text: '> <div>\n> [Ada](person:block)\n>',
      mentions: [],
    });
    expect(parseChatComposerMentions('<!-- [Ada](person:comment)')).toEqual({
      text: '<!-- [Ada](person:comment)',
      mentions: [],
    });
    expect(parseChatComposerMentions('Intro\n\n    [Ada](person:code)')).toEqual({
      text: 'Intro\n\n    [Ada](person:code)',
      mentions: [],
    });
    expect(parseChatComposerMentions('    code\n    [Ada](person:continuation)')).toEqual({
      text: '    code\n    [Ada](person:continuation)',
      mentions: [],
    });
    expect(parseChatComposerMentions('\t[Ada](person:code)\n\t[Ada](person:continuation)')).toEqual(
      {
        text: '\t[Ada](person:code)\n\t[Ada](person:continuation)',
        mentions: [],
      },
    );
    expect(parseChatComposerMentions('    code\n[Ada](person:real)')).toEqual({
      text: '    code\nAda',
      mentions: [{ label: 'Ada', uri: 'person:real', start: 9, end: 12 }],
    });
    expect(parseChatComposerMentions('<')).toEqual({ text: '<', mentions: [] });
    expect(parseChatComposerMentions('<a')).toEqual({ text: '<a', mentions: [] });
    expect(parseChatComposerMentions('<a<a')).toEqual({ text: '<a<a', mentions: [] });
    const uriAutolink = '<https://example.com/[Ada](person:ada)>';
    expect(parseChatComposerMentions(uriAutolink)).toEqual({ text: uriAutolink, mentions: [] });
    const emailAutolink = '<ada@example.com>';
    expect(parseChatComposerMentions(emailAutolink)).toEqual({ text: emailAutolink, mentions: [] });
    expect(parseChatComposerMentions('<[Ada](person:ada)@example.com>')).toEqual({
      text: '<Ada@example.com>',
      mentions: [{ label: 'Ada', uri: 'person:ada', start: 1, end: 4 }],
    });
    expect(parseChatComposerMentions('<https://bad value [Ada](person:real)>')).toEqual({
      text: '<https://bad value Ada>',
      mentions: [{ label: 'Ada', uri: 'person:real', start: 19, end: 22 }],
    });
    expect(parseChatComposerMentions('<span [Ada](person:ada)>')).toEqual({
      text: '<span Ada>',
      mentions: [{ label: 'Ada', uri: 'person:ada', start: 6, end: 9 }],
    });
    expect(parseChatComposerMentions('<span title=">[Ada](person:attribute)">x</span>')).toEqual({
      text: '<span title=">[Ada](person:attribute)">x</span>',
      mentions: [],
    });
    expect(parseChatComposerMentions('<hr>\n[Ada](person:real)')).toEqual({
      text: '<hr>\n[Ada](person:real)',
      mentions: [],
    });
    expect(parseChatComposerMentions('<div/>\n[Ada](person:real)')).toEqual({
      text: '<div/>\n[Ada](person:real)',
      mentions: [],
    });
    expect(parseChatComposerMentions('<DIV>\n[Ada](person:block)\n\n[Ada](person:real)')).toEqual({
      text: '<DIV>\n[Ada](person:block)\n\nAda',
      mentions: [{ label: 'Ada', uri: 'person:real', start: 27, end: 30 }],
    });
    expect(
      parseChatComposerMentions('<div>hello\n[Ada](person:block)\n\n[Ada](person:real)'),
    ).toEqual({
      text: '<div>hello\n[Ada](person:block)\n\nAda',
      mentions: [{ label: 'Ada', uri: 'person:real', start: 32, end: 35 }],
    });
    const closingBlock = '</div> hello\n[Ada](person:block)\n\n[Ada](person:real)';
    const closingBlockText = '</div> hello\n[Ada](person:block)\n\nAda';
    const closingBlockMentionStart = closingBlockText.lastIndexOf('Ada');
    expect(parseChatComposerMentions(closingBlock)).toEqual({
      text: closingBlockText,
      mentions: [
        {
          label: 'Ada',
          uri: 'person:real',
          start: closingBlockMentionStart,
          end: closingBlockMentionStart + 3,
        },
      ],
    });
    expect(parseChatComposerMentions('<span>\n[Ada](person:block)')).toEqual({
      text: '<span>\n[Ada](person:block)',
      mentions: [],
    });
    expect(parseChatComposerMentions('Intro\n\n<span>\n[Ada](person:block)')).toEqual({
      text: 'Intro\n\n<span>\n[Ada](person:block)',
      mentions: [],
    });
    expect(parseChatComposerMentions('Intro\n<span>\n[Ada](person:real)')).toEqual({
      text: 'Intro\n<span>\nAda',
      mentions: [{ label: 'Ada', uri: 'person:real', start: 13, end: 16 }],
    });
    expect(
      parseChatComposerMentions('<SCRIPT>\n[Ada](person:block)\n</script>\n[Ada](person:real)'),
    ).toEqual({
      text: '<SCRIPT>\n[Ada](person:block)\n</script>\nAda',
      mentions: [{ label: 'Ada', uri: 'person:real', start: 39, end: 42 }],
    });
    expect(parseChatComposerMentions('<script>\n[Ada](person:block)')).toEqual({
      text: '<script>\n[Ada](person:block)',
      mentions: [],
    });
    expect(parseChatComposerMentions('<script\n[Ada](person:block)')).toEqual({
      text: '<script\n[Ada](person:block)',
      mentions: [],
    });
    expect(parseChatComposerMentions('<script>\n</script')).toEqual({
      text: '<script>\n</script',
      mentions: [],
    });
    expect(parseChatComposerMentions('<script>\n</style>\n</script>\n[Ada](person:real)')).toEqual({
      text: '<script>\n</style>\n</script>\nAda',
      mentions: [{ label: 'Ada', uri: 'person:real', start: 28, end: 31 }],
    });
    expect(
      parseChatComposerMentions('<![CDATA[\n[Ada](person:block)\n]]>\n[Ada](person:real)'),
    ).toEqual({
      text: '<![CDATA[\n[Ada](person:block)\n]]>\nAda',
      mentions: [{ label: 'Ada', uri: 'person:real', start: 34, end: 37 }],
    });
    const image = '![Logo](asset:logo "[Ada](person:ada)")';
    expect(parseChatComposerMentions(image)).toEqual({ text: image, mentions: [] });
  });
});
