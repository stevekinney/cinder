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
    expect(serializeChatComposerMention({ label: 'A[da]', uri: 'person:ada(eng)' })).toBe(
      '[A\\[da\\]](person:ada\\(eng\\))',
    );
    expect(serializeChatComposerMention({ label: '<Ada> & _owner_', uri: 'person:ada' })).toBe(
      '[\\<Ada\\> \\& \\_owner\\_](person:ada)',
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
    expect(() =>
      serializeChatComposerMention({ label: 'Ada', uri: 'person:ada lovelace' }),
    ).toThrow('requires an absolute non-web entity URI');
    expect(() =>
      serializeChatComposerMention({ label: 'Ada\n\nLovelace', uri: 'person:ada' }),
    ).toThrow('does not accept paragraph breaks');
  });

  test('serializes and deserializes escaped labels and entity URIs without loss', () => {
    const mention = {
      label: 'Miyuki [design] (owner) \\ notes',
      uri: 'linear:issue/CIN-387(chat)[draft]\\日本語',
    };

    const serialized = serializeChatComposerMention(mention);

    expect(deserializeChatComposerMention(serialized)).toEqual(mention);
    const characterReferenceUri = { label: 'Ada', uri: 'person:a&amp;b' };
    expect(
      deserializeChatComposerMention(serializeChatComposerMention(characterReferenceUri)),
    ).toEqual(characterReferenceUri);
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
    expect(parseChatComposerMentions('[Docs](https://x\n\n"[Ada](person:ada)")')).toEqual({
      text: '[Docs](https://x\n\n"Ada")',
      mentions: [{ label: 'Ada', uri: 'person:ada', start: 19, end: 22 }],
    });
    expect(parseChatComposerMentions('[Docs](https://x "title"\n\n) [Ada](person:ada)')).toEqual({
      text: '[Docs](https://x "title"\n\n) Ada',
      mentions: [{ label: 'Ada', uri: 'person:ada', start: 28, end: 31 }],
    });
    for (const malformedAngleDestination of [
      '[Docs](<https://x\n[Ada](person:ada)>',
      '[Docs](<https://x<[Ada](person:ada)>)',
      '[Docs](<https://x [Ada](person:ada)',
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

    expect(parseChatComposerMentions('  ```\ncode\n```\n[Ada](person:ada)')).toEqual({
      text: '  ```\ncode\n```\nAda',
      mentions: [{ label: 'Ada', uri: 'person:ada', start: 15, end: 18 }],
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
      text: '`Ada\\`',
      mentions: [{ label: 'Ada', uri: 'person:ada', start: 1, end: 4 }],
    });

    expect(parseChatComposerMentions('    [Ada](person:ada)')).toEqual({
      text: '    [Ada](person:ada)',
      mentions: [],
    });
    expect(parseChatComposerMentions(' \t[Ada](person:ada)')).toEqual({
      text: ' \t[Ada](person:ada)',
      mentions: [],
    });

    expect(parseChatComposerMentions('Intro\n    [Ada](person:ada)')).toEqual({
      text: 'Intro\n    Ada',
      mentions: [{ label: 'Ada', uri: 'person:ada', start: 10, end: 13 }],
    });

    expect(parseChatComposerMentions('# Heading\n    [Ada](person:ada)')).toEqual({
      text: '# Heading\n    [Ada](person:ada)',
      mentions: [],
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
    const containerDefinition = '> [ref]: /url "[Ada](person:ada)"';
    expect(parseChatComposerMentions(containerDefinition)).toEqual({
      text: containerDefinition,
      mentions: [],
    });
    const nextLineDestination = '[ref]:\n  /url "[Ada](person:ada)"';
    expect(parseChatComposerMentions(nextLineDestination)).toEqual({
      text: nextLineDestination,
      mentions: [],
    });
    expect(parseChatComposerMentions('> [ref]: /url\n[Ada](person:ada)')).toEqual({
      text: '> [ref]: /url\nAda',
      mentions: [{ label: 'Ada', uri: 'person:ada', start: 14, end: 17 }],
    });
    expect(parseChatComposerMentions('> [ref]:\n/url "[Ada](person:ada)"')).toEqual({
      text: '> [ref]:\n/url "Ada"',
      mentions: [{ label: 'Ada', uri: 'person:ada', start: 15, end: 18 }],
    });
    const interruptedParagraph = 'paragraph\n2. [ref]: /url "[Ada](person:ada)"';
    const interruptedParagraphResult = parseChatComposerMentions(interruptedParagraph);
    expect(interruptedParagraphResult.text).toBe('paragraph\n2. [ref]: /url "Ada"');
    expect(interruptedParagraphResult.mentions).toEqual([
      {
        label: 'Ada',
        uri: 'person:ada',
        start: interruptedParagraphResult.text.lastIndexOf('Ada'),
        end: interruptedParagraphResult.text.length - 1,
      },
    ]);
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
    const unterminatedReferences = '[\n'.repeat(10_000);
    expect(parseChatComposerMentions(unterminatedReferences)).toEqual({
      text: unterminatedReferences,
      mentions: [],
    });
    const nestedImages = '![['.repeat(10_000);
    expect(parseChatComposerMentions(nestedImages)).toEqual({ text: nestedImages, mentions: [] });
    const unterminatedComments = `x ${'<!-- '.repeat(20_000)}`;
    expect(parseChatComposerMentions(unterminatedComments)).toEqual({
      text: unterminatedComments,
      mentions: [],
    });
  });

  test('handles delimiter-heavy input with bounded forward scans', () => {
    const value = `${'`'.repeat(100_000)}\n${'$'.repeat(100_000)}\n${'$5 '.repeat(25_000)}\n${' ~'.repeat(25_000)}\n${'<a'.repeat(25_000)}`;

    expect(parseChatComposerMentions(value)).toEqual({ text: value, mentions: [] });
    const entityHeavyLabel = '&'.repeat(25_000);
    expect(parseChatComposerMentions(`[${entityHeavyLabel}](person:a)`)).toEqual({
      text: entityHeavyLabel,
      mentions: [{ label: entityHeavyLabel, uri: 'person:a', start: 0, end: 25_000 }],
    });
    const escapedDelimiterLabel = '\\*'.repeat(25_000);
    expect(
      parseChatComposerMentions(`[${escapedDelimiterLabel}](person:a)`).mentions[0]?.label,
    ).toBe('*'.repeat(25_000));
  });

  test('keeps per-character scan metadata bounded', () => {
    const value = `${'plain text '.repeat(10_000)}\n\`code\` $math$`;
    const metadata = makeScanMetadata(value);

    expect(metadata.escaped.length).toBe(value.length);
    expect(metadata.lineStarts.length).toBe(value.length);
    expect(metadata.containerStarts.size).toBe(0);
    expect(metadata.containerContexts.size).toBe(0);
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
    ).toEqual([
      { label: 'Ada', uri: 'person:ada', start: 8, end: 11 },
      { label: 'Ada', uri: 'person:real', start: 20, end: 23 },
    ]);
    expect(parseChatComposerMentions('1. ```\n1. [Ada](person:ada)\n1. ```').mentions).toEqual([
      { label: 'Ada', uri: 'person:ada', start: 10, end: 13 },
    ]);
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
    expect(parseChatComposerMentions('- > ```\n  > [Ada](person:ada)').mentions).toEqual([]);
    expect(parseChatComposerMentions('10. ```\n    [Ada](person:ada)').mentions).toEqual([]);

    const implicitlyClosedFence = '> ```\n> code\n[Ada](person:real)';
    const implicitlyClosedFenceResult = parseChatComposerMentions(implicitlyClosedFence);
    expect(implicitlyClosedFenceResult.text).toBe('> ```\n> code\nAda');
    expect(implicitlyClosedFenceResult.mentions).toEqual([
      {
        label: 'Ada',
        uri: 'person:real',
        start: implicitlyClosedFenceResult.text.lastIndexOf('Ada'),
        end: implicitlyClosedFenceResult.text.length,
      },
    ]);
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
    expect(parseChatComposerMentions('$2+[Ada](person:ada)$')).toEqual({
      text: '$2+[Ada](person:ada)$',
      mentions: [],
    });
    expect(parseChatComposerMentions('$x\n\n[Ada](person:ada)x$')).toEqual({
      text: '$x\n\nAdax$',
      mentions: [{ label: 'Ada', uri: 'person:ada', start: 4, end: 7 }],
    });
    expect(parseChatComposerMentions('$$\n\n[Ada](person:ada)\n$$')).toEqual({
      text: '$$\n\n[Ada](person:ada)\n$$',
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
    expect(
      parseChatComposerMentions('Intro <!-- [Ada](person:comment) --> [Ada](person:real)'),
    ).toEqual({
      text: 'Intro <!-- [Ada](person:comment) --> Ada',
      mentions: [{ label: 'Ada', uri: 'person:real', start: 37, end: 40 }],
    });
    const blockCommentClosingLine = '<!-- x --> [Ada](person:comment)\n[Ada](person:real)';
    expect(parseChatComposerMentions(blockCommentClosingLine)).toEqual({
      text: '<!-- x --> [Ada](person:comment)\nAda',
      mentions: [{ label: 'Ada', uri: 'person:real', start: 33, end: 36 }],
    });
    const processingInstructionClosingLine = '<?x?> [Ada](person:instruction)\n[Ada](person:real)';
    expect(parseChatComposerMentions(processingInstructionClosingLine)).toEqual({
      text: '<?x?> [Ada](person:instruction)\nAda',
      mentions: [{ label: 'Ada', uri: 'person:real', start: 32, end: 35 }],
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
    expect(parseChatComposerMentions('> <div>\n> [Ada](person:block)\n[Ada](person:real)')).toEqual(
      {
        text: '> <div>\n> [Ada](person:block)\nAda',
        mentions: [{ label: 'Ada', uri: 'person:real', start: 30, end: 33 }],
      },
    );
    expect(parseChatComposerMentions('<?php\n[Ada](person:block)')).toEqual({
      text: '<?php\n[Ada](person:block)',
      mentions: [],
    });
    expect(parseChatComposerMentions('<!DOCTYPE\n[Ada](person:block)')).toEqual({
      text: '<!DOCTYPE\n[Ada](person:block)',
      mentions: [],
    });
    expect(parseChatComposerMentions('Intro <![CDATA[ [Ada](person:real)')).toEqual({
      text: 'Intro <![CDATA[ Ada',
      mentions: [{ label: 'Ada', uri: 'person:real', start: 16, end: 19 }],
    });
    expect(
      parseChatComposerMentions('Intro <![CDATA[[Ada](person:block)]]> [Grace](person:real)'),
    ).toEqual({
      text: 'Intro <![CDATA[[Ada](person:block)]]> Grace',
      mentions: [{ label: 'Grace', uri: 'person:real', start: 38, end: 43 }],
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
    const gfmLiteralAutolink = 'https://example.com/[Ada](person:ada)';
    expect(parseChatComposerMentions(gfmLiteralAutolink)).toEqual({
      text: gfmLiteralAutolink,
      mentions: [],
    });
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
    expect(parseChatComposerMentions('Text </span title="[Ada](person:ada)">')).toEqual({
      text: 'Text </span title="Ada">',
      mentions: [{ label: 'Ada', uri: 'person:ada', start: 19, end: 22 }],
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
    expect(parseChatComposerMentions('<span>   \n[Ada](person:block)')).toEqual({
      text: '<span>   \n[Ada](person:block)',
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
    const rawTextClosingLine = '<script>\n</script> [Ada](person:block)\n[Ada](person:real)';
    const rawTextClosingResult = parseChatComposerMentions(rawTextClosingLine);
    expect(rawTextClosingResult.text).toBe('<script>\n</script> [Ada](person:block)\nAda');
    expect(rawTextClosingResult.mentions).toEqual([
      {
        label: 'Ada',
        uri: 'person:real',
        start: rawTextClosingResult.text.lastIndexOf('Ada'),
        end: rawTextClosingResult.text.length,
      },
    ]);
    expect(parseChatComposerMentions('<script>x</script> [Ada](person:block)')).toEqual({
      text: '<script>x</script> [Ada](person:block)',
      mentions: [],
    });
    expect(
      parseChatComposerMentions('<script>\n</scriptx>\n</script>\n[Ada](person:real)'),
    ).toEqual({
      text: '<script>\n</scriptx>\n</script>\nAda',
      mentions: [{ label: 'Ada', uri: 'person:real', start: 30, end: 33 }],
    });
    const malformedRawTextClose = '<script>\n</script title="\n\n">\n</script>\n[Ada](person:real)';
    const malformedRawTextCloseResult = parseChatComposerMentions(malformedRawTextClose);
    expect(malformedRawTextCloseResult.text).toBe(
      '<script>\n</script title="\n\n">\n</script>\nAda',
    );
    expect(malformedRawTextCloseResult.mentions).toEqual([
      {
        label: 'Ada',
        uri: 'person:real',
        start: malformedRawTextCloseResult.text.lastIndexOf('Ada'),
        end: malformedRawTextCloseResult.text.length,
      },
    ]);
    expect(parseChatComposerMentions('Intro <span title="\n\n[Ada](person:real)">')).toEqual({
      text: 'Intro <span title="\n\nAda">',
      mentions: [{ label: 'Ada', uri: 'person:real', start: 21, end: 24 }],
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
    const nestedImage = '![Team [Ada](person:ada)](asset:logo)';
    expect(parseChatComposerMentions(nestedImage)).toEqual({ text: nestedImage, mentions: [] });
    const paragraphBreakLabel = '[Ada\n\nLovelace](person:ada)';
    expect(parseChatComposerMentions(paragraphBreakLabel)).toEqual({
      text: paragraphBreakLabel,
      mentions: [],
    });
    const paragraphBreakImage = parseChatComposerMentions('![Docs\n\n[Ada](person:a)](asset:x)');
    expect(paragraphBreakImage.text).toBe('![Docs\n\nAda](asset:x)');
    expect(paragraphBreakImage.mentions).toEqual([
      {
        label: 'Ada',
        uri: 'person:a',
        start: paragraphBreakImage.text.indexOf('Ada'),
        end: paragraphBreakImage.text.indexOf('Ada') + 3,
      },
    ]);
    const invalidAngleReference = parseChatComposerMentions(
      '[ref]: <https://x<y> "[Ada](person:a)"',
    );
    expect(invalidAngleReference.text).toBe('[ref]: <https://x<y> "Ada"');
    expect(invalidAngleReference.mentions).toEqual([
      {
        label: 'Ada',
        uri: 'person:a',
        start: invalidAngleReference.text.indexOf('Ada'),
        end: invalidAngleReference.text.indexOf('Ada') + 3,
      },
    ]);
    expect(parseChatComposerMentions('Intro <?x > [Ada](person:a) ?>')).toEqual({
      text: 'Intro <?x > [Ada](person:a) ?>',
      mentions: [],
    });
    expect(parseChatComposerMentions('Intro <?x [Ada](person:a)')).toEqual({
      text: 'Intro <?x Ada',
      mentions: [{ label: 'Ada', uri: 'person:a', start: 10, end: 13 }],
    });
    expect(parseChatComposerMentions('<script>\n</script >\n[Ada](person:a)')).toEqual({
      text: '<script>\n</script >\n[Ada](person:a)',
      mentions: [],
    });
    const interruptedReference = parseChatComposerMentions(
      'paragraph\n[ref]: /url "[Ada](person:a)"',
    );
    expect(interruptedReference.text).toBe('paragraph\n[ref]: /url "Ada"');
    expect(interruptedReference.mentions).toEqual([
      {
        label: 'Ada',
        uri: 'person:a',
        start: interruptedReference.text.indexOf('Ada'),
        end: interruptedReference.text.indexOf('Ada') + 3,
      },
    ]);
    const nestedReferenceLabel = parseChatComposerMentions('[ref[x]: /url "[Ada](person:a)"');
    expect(nestedReferenceLabel.text).toBe('[ref[x]: /url "Ada"');
    expect(nestedReferenceLabel.mentions).toEqual([
      {
        label: 'Ada',
        uri: 'person:a',
        start: nestedReferenceLabel.text.indexOf('Ada'),
        end: nestedReferenceLabel.text.indexOf('Ada') + 3,
      },
    ]);
    expect(parseChatComposerMentions('<input>\n[Ada](person:a)')).toEqual({
      text: '<input>\n[Ada](person:a)',
      mentions: [],
    });
    const escapedAngleLink = '[Docs](<https://x\\<y> "[Ada](person:a)")';
    expect(parseChatComposerMentions(escapedAngleLink)).toEqual({
      text: escapedAngleLink,
      mentions: [],
    });
    expect(parseChatComposerMentions('<div\n[Ada](person:a)')).toEqual({
      text: '<div\n[Ada](person:a)',
      mentions: [],
    });
    expect(parseChatComposerMentions('<www.example.com> [Ada](person:a)')).toEqual({
      text: '<www.example.com> Ada',
      mentions: [{ label: 'Ada', uri: 'person:a', start: 18, end: 21 }],
    });
    expect(parseChatComposerMentions('<www.> [Ada](person:a)')).toEqual({
      text: '<www.> Ada',
      mentions: [{ label: 'Ada', uri: 'person:a', start: 7, end: 10 }],
    });
    expect(parseChatComposerMentions('https://[Ada](person:a)')).toEqual({
      text: 'https://Ada',
      mentions: [{ label: 'Ada', uri: 'person:a', start: 8, end: 11 }],
    });
    expect(parseChatComposerMentions('www.[Ada](person:a)')).toEqual({
      text: 'www.Ada',
      mentions: [{ label: 'Ada', uri: 'person:a', start: 4, end: 7 }],
    });
    expect(parseChatComposerMentions('www.example.com [Ada](person:a)')).toEqual({
      text: 'www.example.com Ada',
      mentions: [{ label: 'Ada', uri: 'person:a', start: 16, end: 19 }],
    });
    expect(parseChatComposerMentions('Intro <!-- bad--comment [Ada](person:a) -->')).toEqual({
      text: 'Intro <!-- bad--comment Ada -->',
      mentions: [{ label: 'Ada', uri: 'person:a', start: 24, end: 27 }],
    });
    expect(parseChatComposerMentions('> text\n> <div>\n> [Ada](person:block)\n> </div>')).toEqual({
      text: '> text\n> <div>\n> [Ada](person:block)\n> </div>',
      mentions: [],
    });
    expect(parseChatComposerMentions('paragraph\n>     [Ada](person:code)')).toEqual({
      text: 'paragraph\n>     [Ada](person:code)',
      mentions: [],
    });
    expect(parseChatComposerMentions('> paragraph\n> [ref]: /url "[Ada](person:a)"')).toEqual({
      text: '> paragraph\n> [ref]: /url "Ada"',
      mentions: [{ label: 'Ada', uri: 'person:a', start: 27, end: 30 }],
    });
    for (const tag of ['base', 'basefont', 'option', 'search', 'track']) {
      const value = `<${tag}>\n[Ada](person:a)`;
      expect(parseChatComposerMentions(value)).toEqual({ text: value, mentions: [] });
    }
    const multilineReferenceLabel = '[ref\nlabel]: /url "[Ada](person:a)"';
    expect(parseChatComposerMentions(multilineReferenceLabel)).toEqual({
      text: multilineReferenceLabel,
      mentions: [],
    });
    expect(parseChatComposerMentions('[Ada](person:<id>)')).toEqual({
      text: '[Ada](person:<id>)',
      mentions: [],
    });
    expect(parseChatComposerMentions('[A&#38;B](person&#58;ab)')).toEqual({
      text: 'A&B',
      mentions: [{ label: 'A&B', uri: 'person:ab', start: 0, end: 3 }],
    });
    expect(parseChatComposerMentions('[A&#x26;B](person&#x3A;ab)')).toEqual({
      text: 'A&B',
      mentions: [{ label: 'A&B', uri: 'person:ab', start: 0, end: 3 }],
    });
    expect(parseChatComposerMentions('[A&copy;B](person&colon;ab)')).toEqual({
      text: 'A©B',
      mentions: [{ label: 'A©B', uri: 'person:ab', start: 0, end: 3 }],
    });
    expect(parseChatComposerMentions('[A&unknown;](person:a)')).toEqual({
      text: 'A&unknown;',
      mentions: [{ label: 'A&unknown;', uri: 'person:a', start: 0, end: 10 }],
    });
    expect(parseChatComposerMentions('> <div>\n>\n> [Ada](person:a)')).toEqual({
      text: '> <div>\n>\n> Ada',
      mentions: [{ label: 'Ada', uri: 'person:a', start: 12, end: 15 }],
    });
    expect(parseChatComposerMentions('$x\n# [Ada](person:a)\nend$')).toEqual({
      text: '$x\n# Ada\nend$',
      mentions: [{ label: 'Ada', uri: 'person:a', start: 5, end: 8 }],
    });
    expect(parseChatComposerMentions('$$$[Ada](person:a)$$$')).toEqual({
      text: '$$$[Ada](person:a)$$$',
      mentions: [],
    });
    expect(parseChatComposerMentions('$ [Ada](person:a)')).toEqual({
      text: '$ Ada',
      mentions: [{ label: 'Ada', uri: 'person:a', start: 2, end: 5 }],
    });
    expect(parseChatComposerMentions('![Ada](person:image)')).toEqual({
      text: '![Ada](person:image)',
      mentions: [],
    });
    expect(parseChatComposerMentions('![Ada][missing]')).toEqual({
      text: '![Ada][missing]',
      mentions: [],
    });
    expect(parseChatComposerMentions('![logo [Ada](person:a)][missing]')).toEqual({
      text: '![logo Ada][missing]',
      mentions: [{ label: 'Ada', uri: 'person:a', start: 7, end: 10 }],
    });
    expect(parseChatComposerMentions('![logo [Ada](person:a)]')).toEqual({
      text: '![logo Ada]',
      mentions: [{ label: 'Ada', uri: 'person:a', start: 7, end: 10 }],
    });
    const resolvedImage = '[logo]: /logo\n![Ada][logo]';
    expect(parseChatComposerMentions(resolvedImage)).toEqual({ text: resolvedImage, mentions: [] });
    const normalizedResolvedImage = '[lo  go]: /logo\n![logo [Ada](person:a)][LO GO]';
    expect(parseChatComposerMentions(normalizedResolvedImage)).toEqual({
      text: normalizedResolvedImage,
      mentions: [],
    });
    const fencedDefinition = '```\n[logo]: /logo\n```\n![logo [Ada](person:a)][logo]';
    expect(parseChatComposerMentions(fencedDefinition)).toEqual({
      text: '```\n[logo]: /logo\n```\n![logo Ada][logo]',
      mentions: [{ label: 'Ada', uri: 'person:a', start: 29, end: 32 }],
    });
    const indentedDefinition = '    [logo]: /logo\n\n![logo [Ada](person:a)][logo]';
    expect(parseChatComposerMentions(indentedDefinition)).toEqual({
      text: '    [logo]: /logo\n\n![logo Ada][logo]',
      mentions: [{ label: 'Ada', uri: 'person:a', start: 26, end: 29 }],
    });
    expect(parseChatComposerMentions('[Docs](https://x (bad [Ada](person:a)))')).toEqual({
      text: '[Docs](https://x (bad Ada))',
      mentions: [{ label: 'Ada', uri: 'person:a', start: 22, end: 25 }],
    });
    expect(parseChatComposerMentions('[Docs](https://x (title\n[Ada](person:a))')).toEqual({
      text: '[Docs](https://x (title\nAda)',
      mentions: [{ label: 'Ada', uri: 'person:a', start: 24, end: 27 }],
    });
    expect(parseChatComposerMentions('<span />\n[Ada](person:a)')).toEqual({
      text: '<span />\n[Ada](person:a)',
      mentions: [],
    });
    expect(parseChatComposerMentions('[ref]: /u\\ v "[Ada](person:a)"')).toEqual({
      text: '[ref]: /u\\ v "Ada"',
      mentions: [{ label: 'Ada', uri: 'person:a', start: 14, end: 17 }],
    });
    const escapedReferenceDestination = '[ref]: /u\\*v "[Ada](person:a)"';
    expect(parseChatComposerMentions(escapedReferenceDestination)).toEqual({
      text: escapedReferenceDestination,
      mentions: [],
    });
    expect(parseChatComposerMentions('[Team [East]](person:east)')).toEqual({
      text: 'Team [East]',
      mentions: [{ label: 'Team [East]', uri: 'person:east', start: 0, end: 11 }],
    });
    expect(parseChatComposerMentions('[Ada](<person:ada>)')).toEqual({
      text: 'Ada',
      mentions: [{ label: 'Ada', uri: 'person:ada', start: 0, end: 3 }],
    });
    expect(parseChatComposerMentions('[Ada](person:a "Engineer")')).toEqual({
      text: 'Ada',
      mentions: [{ label: 'Ada', uri: 'person:a', start: 0, end: 3 }],
    });
    expect(parseChatComposerMentions('[ref]: /url (bad [Ada](person:a)')).toEqual({
      text: '[ref]: /url (bad Ada',
      mentions: [{ label: 'Ada', uri: 'person:a', start: 17, end: 20 }],
    });
    const multilineContainerReference = '> [foo\n> bar]: /logo\n> ![logo [Ada](person:a)][foo bar]';
    expect(parseChatComposerMentions(multilineContainerReference)).toEqual({
      text: multilineContainerReference,
      mentions: [],
    });
    expect(
      parseChatComposerMentions('<div>\n[img]: /logo\n</div>\n\n![logo [Ada](person:a)][img]'),
    ).toEqual({
      text: '<div>\n[img]: /logo\n</div>\n\n![logo Ada][img]',
      mentions: [{ label: 'Ada', uri: 'person:a', start: 34, end: 37 }],
    });
    expect(
      parseChatComposerMentions(
        '<script>\n[img]: /logo\n</script>\n\n![logo [Ada](person:a)][img]',
      ),
    ).toEqual({
      text: '<script>\n[img]: /logo\n</script>\n\n![logo Ada][img]',
      mentions: [{ label: 'Ada', uri: 'person:a', start: 40, end: 43 }],
    });
    expect(parseChatComposerMentions('Heading\n---\n[ref]: /url "[Ada](person:a)"')).toEqual({
      text: 'Heading\n---\n[ref]: /url "[Ada](person:a)"',
      mentions: [],
    });
    const setextReference = 'Heading\n===\n[ref]: /url "[Ada](person:a)"';
    expect(parseChatComposerMentions(setextReference)).toEqual({
      text: setextReference,
      mentions: [],
    });
    expect(parseChatComposerMentions('ftp://example.com/[Ada](person:a)')).toEqual({
      text: 'ftp://example.com/[Ada](person:a)',
      mentions: [],
    });
    const repeatedInvalidAutolinks = 'http://x/'.repeat(20000);
    expect(parseChatComposerMentions(repeatedInvalidAutolinks)).toEqual({
      text: repeatedInvalidAutolinks,
      mentions: [],
    });
    expect(parseChatComposerMentions('http://x/http://example.com/[Ada](person:a)')).toEqual({
      text: 'http://x/http://example.com/[Ada](person:a)',
      mentions: [],
    });
    expect(parseChatComposerMentions('http://http://example.com/[Ada](person:a)')).toEqual({
      text: 'http://http://example.com/[Ada](person:a)',
      mentions: [],
    });
    expect(parseChatComposerMentions('http://example.com:8080/[Ada](person:a)')).toEqual({
      text: 'http://example.com:8080/[Ada](person:a)',
      mentions: [],
    });
    expect(parseChatComposerMentions('http://example.com:/[Ada](person:a)')).toEqual({
      text: 'http://example.com:/Ada',
      mentions: [{ label: 'Ada', uri: 'person:a', start: 20, end: 23 }],
    });
    expect(parseChatComposerMentions('http://example.com!/[Ada](person:a)')).toEqual({
      text: 'http://example.com!/Ada',
      mentions: [{ label: 'Ada', uri: 'person:a', start: 20, end: 23 }],
    });
    for (const image of ['![Ada][logo]', '![Ada]', '![Ada](asset:logo)', '![A\\]da][logo]']) {
      expect(parseChatComposerMentions(image).mentions).toEqual([]);
    }
    const referenceImage = '![logo [Ada](person:a)][img]\n\n[img]: /logo.png';
    expect(parseChatComposerMentions(referenceImage)).toEqual({
      text: referenceImage,
      mentions: [],
    });
    expect(parseChatComposerMentions('- item\n\n    [Ada](person:a)')).toEqual({
      text: '- item\n\n    Ada',
      mentions: [{ label: 'Ada', uri: 'person:a', start: 12, end: 15 }],
    });
    const listIndentedCode = '- item\n\n        [Ada](person:a)';
    expect(parseChatComposerMentions(listIndentedCode)).toEqual({
      text: listIndentedCode,
      mentions: [],
    });
    expect(parseChatComposerMentions('> [foo\n>\n> bar]: /url\n[Ada](person:a)')).toEqual({
      text: '> [foo\n>\n> bar]: /url\nAda',
      mentions: [{ label: 'Ada', uri: 'person:a', start: 22, end: 25 }],
    });
    expect(serializeChatComposerMention({ label: 'Ada', uri: 'person:a|b' })).toBe(
      '[Ada](person:a\\|b)',
    );
    expect(deserializeChatComposerMention('[Ada](person:a\\|b)')).toEqual({
      label: 'Ada',
      uri: 'person:a|b',
    });
    expect(deserializeChatComposerMention('[Team [East]](person:east)')).toEqual({
      label: 'Team [East]',
      uri: 'person:east',
    });
    expect(deserializeChatComposerMention('[[Ada](person:a)](person:outer)')).toBeNull();
    expect(deserializeChatComposerMention('[Ada](person:a "unterminated)')).toBeNull();
    expect(parseChatComposerMentions('[Docs](https://x\\ y "[Ada](person:a)")')).toEqual({
      text: '[Docs](https://x\\ y "Ada")',
      mentions: [{ label: 'Ada', uri: 'person:a', start: 21, end: 24 }],
    });
    const blockComment = '<!-- bad--comment [Ada](person:a) -->';
    expect(parseChatComposerMentions(blockComment)).toEqual({ text: blockComment, mentions: [] });
    const closingHtmlBlock = '</span>\n[Ada](person:a)';
    expect(parseChatComposerMentions(closingHtmlBlock)).toEqual({
      text: closingHtmlBlock,
      mentions: [],
    });
    expect(parseChatComposerMentions('[Docs](https://x (title\n\n[Ada](person:a)))')).toEqual({
      text: '[Docs](https://x (title\n\nAda))',
      mentions: [{ label: 'Ada', uri: 'person:a', start: 25, end: 28 }],
    });
    const multilineReferenceTitle = '[ref]: /url "title\n[Ada](person:a)\nend"';
    expect(parseChatComposerMentions(multilineReferenceTitle)).toEqual({
      text: multilineReferenceTitle,
      mentions: [],
    });
    const escapedReferenceContainer = parseChatComposerMentions(
      '> [ref]: /url "title\n[Ada](person:a)\nend"',
    );
    expect(escapedReferenceContainer.text).toBe('> [ref]: /url "title\nAda\nend"');
    expect(escapedReferenceContainer.mentions).toEqual([
      { label: 'Ada', uri: 'person:a', start: 21, end: 24 },
    ]);

    const closingTypeSixBlock = '</div\n[Ada](person:a)';
    expect(parseChatComposerMentions(closingTypeSixBlock)).toEqual({
      text: closingTypeSixBlock,
      mentions: [],
    });

    expect(parseChatComposerMentions('[**Ada**](person:a)')).toEqual({
      text: 'Ada',
      mentions: [{ label: 'Ada', uri: 'person:a', start: 0, end: 3 }],
    });
    expect(parseChatComposerMentions('[*Ada*](person:a)')).toEqual({
      text: 'Ada',
      mentions: [{ label: 'Ada', uri: 'person:a', start: 0, end: 3 }],
    });
    expect(parseChatComposerMentions('[` Ada `](person:a)')).toEqual({
      text: 'Ada',
      mentions: [{ label: 'Ada', uri: 'person:a', start: 0, end: 3 }],
    });
    expect(parseChatComposerMentions('[~Ada~](person:a)')).toEqual({
      text: '[~Ada~](person:a)',
      mentions: [],
    });
    expect(parseChatComposerMentions('[a*"Ada"*](person:a)')).toEqual({
      text: '[a*"Ada"*](person:a)',
      mentions: [],
    });

    expect(parseChatComposerMentions('[ref]: <url>"[Ada](person:a)"')).toEqual({
      text: '[ref]: <url>"Ada"',
      mentions: [{ label: 'Ada', uri: 'person:a', start: 13, end: 16 }],
    });

    const siblingListFences = '- ```\n- ```\n  [Ada](person:a)';
    expect(parseChatComposerMentions(siblingListFences)).toEqual({
      text: siblingListFences,
      mentions: [],
    });
  });
});
