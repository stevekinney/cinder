import { decodeNamedCharacterReference } from 'decode-named-character-reference';
import { decodeNumericCharacterReference } from 'micromark-util-decode-numeric-character-reference';

type DelimiterOpener = {
  start: number;
  remaining: number;
  canClose: boolean;
  matched: boolean;
};

export function projectMentionLabel(value: string): string | null {
  const escaped = new Uint8Array(value.length);
  const literalDelimiter = new Uint8Array(value.length);
  const removed = new Uint8Array(value.length);
  const openers = new Map<string, DelimiterOpener[]>();
  const codeEnds = new Map<number, number>();
  const nextCodeRun = new Map<number, number>();
  let backslashes = 0;
  for (let index = 0; index < value.length; index += 1) {
    escaped[index] = backslashes % 2;
    backslashes = value[index] === '\\' ? backslashes + 1 : 0;
  }

  for (let index = value.length - 1; index >= 0; ) {
    if (value[index] !== '`') {
      index -= 1;
      continue;
    }
    let start = index;
    while (start > 0 && value[start - 1] === '`') start -= 1;
    const length = index - start + 1;
    if (escaped[start] === 0) {
      const next = nextCodeRun.get(length);
      if (next !== undefined) codeEnds.set(start, next);
      nextCodeRun.set(length, start);
    }
    index = start - 1;
  }

  for (let index = 0; index < value.length; ) {
    const codeEnd = codeEnds.get(index);
    if (codeEnd !== undefined) {
      index = codeEnd;
      while (value[index] === '`') index += 1;
      continue;
    }
    if (escaped[index] === 1 || !/[*_~]/u.test(value[index]!)) {
      index += 1;
      continue;
    }
    const character = value[index]!;
    let length = 1;
    while (value[index + length] === character) length += 1;
    if (character === '~' && length !== 2) return null;

    const before = value[index - 1] ?? '';
    const after = value[index + length] ?? '';
    const beforeWhitespace = before.length === 0 || /\s/u.test(before);
    const afterWhitespace = after.length === 0 || /\s/u.test(after);
    const beforePunctuation = /[\p{P}\p{S}]/u.test(before);
    const afterPunctuation = /[\p{P}\p{S}]/u.test(after);
    const leftFlanking =
      !afterWhitespace && (!afterPunctuation || beforeWhitespace || beforePunctuation);
    const rightFlanking =
      !beforeWhitespace && (!beforePunctuation || afterWhitespace || afterPunctuation);
    const canOpen =
      character === '_' ? leftFlanking && (!rightFlanking || beforePunctuation) : leftFlanking;
    const canClose =
      character === '_' ? rightFlanking && (!leftFlanking || afterPunctuation) : rightFlanking;
    const stack = openers.get(character) ?? [];
    let closingRemaining = length;

    if (canClose) {
      while (closingRemaining > 0 && stack.length > 0) {
        const opening = stack.at(-1)!;
        const ruleOfThreeBlocksMatch =
          opening.canClose &&
          canOpen &&
          (opening.remaining + closingRemaining) % 3 === 0 &&
          opening.remaining % 3 !== 0 &&
          closingRemaining % 3 !== 0;
        if (ruleOfThreeBlocksMatch) break;

        const consumed = Math.min(opening.remaining, closingRemaining);
        removed.fill(
          1,
          opening.start + opening.remaining - consumed,
          opening.start + opening.remaining,
        );
        const closingConsumed = length - closingRemaining;
        removed.fill(1, index + closingConsumed, index + closingConsumed + consumed);
        opening.matched = true;
        opening.remaining -= consumed;
        closingRemaining -= consumed;
        if (opening.remaining === 0) stack.pop();
        else literalDelimiter.fill(1, opening.start, opening.start + opening.remaining);
      }
    }

    const matchedClosingCharacters = length - closingRemaining;
    if (matchedClosingCharacters > 0 && closingRemaining > 0) {
      literalDelimiter.fill(1, index + matchedClosingCharacters, index + length);
    }
    if (canOpen && closingRemaining > 0) {
      stack.push({
        start: index + length - closingRemaining,
        remaining: closingRemaining,
        canClose,
        matched: matchedClosingCharacters > 0,
      });
    }
    if (stack.length > 0) openers.set(character, stack);
    else openers.delete(character);
    index += length;
  }
  if ([...openers.values()].some((stack) => stack.some((opening) => !opening.matched))) return null;

  let projected = '';
  let plain = '';
  const flushPlain = () => {
    const decoded = unescapeMarkdown(plain);
    if (decoded === null) return false;
    projected += decoded;
    plain = '';
    return true;
  };
  for (let index = 0; index < value.length; ) {
    const codeEnd = codeEnds.get(index);
    if (codeEnd !== undefined) {
      if (!flushPlain()) return null;
      const openingLength = countRepeated(value, index, '`');
      let code = value.slice(index + openingLength, codeEnd).replace(/\r\n?|\n/gu, ' ');
      if (code.startsWith(' ') && code.endsWith(' ') && /[^ ]/u.test(code))
        code = code.slice(1, -1);
      projected += code;
      index = codeEnd + openingLength;
      continue;
    }
    if (
      removed[index] === 0 &&
      literalDelimiter[index] === 0 &&
      escaped[index] === 0 &&
      /[*_~]/u.test(value[index]!)
    )
      return null;
    if (removed[index] === 0) plain += value[index];
    index += 1;
  }
  return flushPlain() ? projected : null;
}

function countRepeated(value: string, start: number, character: string): number {
  let length = 0;
  while (value[start + length] === character) length += 1;
  return length;
}

export function unescapeMarkdown(value: string, escapeWhitespace = false): string | null {
  let unescaped = '';

  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== '\\') {
      if (value[index] === '&') {
        const limit = Math.min(value.length, index + 33);
        let semicolon = index + 1;
        while (semicolon < limit && value[semicolon] !== ';') semicolon += 1;
        if (semicolon < limit) {
          const reference = value.slice(index + 1, semicolon);
          const hexadecimal = /^#[xX]([0-9A-Fa-f]{1,6})$/u.exec(reference);
          const decimal = /^#([0-9]{1,7})$/u.exec(reference);
          const named =
            hexadecimal === null && decimal === null
              ? decodeNamedCharacterReference(reference)
              : false;
          const decoded =
            hexadecimal !== null
              ? decodeNumericCharacterReference(hexadecimal[1]!, 16)
              : decimal !== null
                ? decodeNumericCharacterReference(decimal[1]!, 10)
                : named;
          if (decoded !== false) {
            unescaped += decoded;
            index = semicolon;
            continue;
          }
        }
      }
      unescaped += value[index];
      continue;
    }

    const escapedCharacter = value[index + 1];
    if (escapedCharacter === undefined) return null;

    const isPunctuation = /[!"#$%&'()*+,-./:;<=>?@[\]^_`{|}~\\]/u.test(escapedCharacter);
    if (!isPunctuation && !(escapeWhitespace && /\s/u.test(escapedCharacter))) {
      unescaped += `\\${escapedCharacter}`;
      index += 1;
      continue;
    }

    unescaped += escapedCharacter;
    index += 1;
  }

  return unescaped;
}
