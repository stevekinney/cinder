export type MappedText = {
  text: string;
  sourceOffsets: number[];
  malformedOffsets?: number[];
};

export function decodeJavaScriptText(raw: string, sourceOffset: number): MappedText {
  const text: string[] = [];
  const sourceOffsets: number[] = [];
  const malformedOffsets: number[] = [];
  const appendDecoded = (value: string, sourceOffsetForValue: number): void => {
    for (let unit = 0; unit < value.length; unit++) {
      text.push(value[unit]!);
      sourceOffsets.push(sourceOffsetForValue);
    }
  };
  for (let index = 0; index < raw.length; index++) {
    const character = raw[index]!;
    if (character !== '\\') {
      appendDecoded(character, sourceOffset + index);
      continue;
    }
    const escapeOffset = sourceOffset + index;
    const next = raw[index + 1];
    if (next === undefined) {
      malformedOffsets.push(escapeOffset);
      appendDecoded('\\', escapeOffset);
      continue;
    }
    const replacements: Record<string, string> = {
      b: '\b',
      f: '\f',
      n: '\n',
      r: '\r',
      t: '\t',
      v: '\v',
      '0': '\0',
      '\\': '\\',
      "'": "'",
      '"': '"',
      '`': '`',
    };
    const replacement = replacements[next];
    if (replacement !== undefined) {
      appendDecoded(replacement, escapeOffset);
      index++;
      continue;
    }
    if (next === '\n' || next === '\r') {
      index++;
      if (next === '\r' && raw[index + 1] === '\n') index++;
      continue;
    }
    if (next === 'x' && /^[0-9a-fA-F]{2}$/.test(raw.slice(index + 2, index + 4))) {
      appendDecoded(
        String.fromCharCode(Number.parseInt(raw.slice(index + 2, index + 4), 16)),
        escapeOffset,
      );
      index += 3;
      continue;
    }
    if (next === 'u') {
      const brace = raw[index + 2] === '{';
      const end = brace ? raw.indexOf('}', index + 3) : index + 6;
      const digits = raw.slice(brace ? index + 3 : index + 2, end);
      const codePoint = Number.parseInt(digits, 16);
      if (
        /^[0-9a-fA-F]+$/.test(digits) &&
        Number.isInteger(codePoint) &&
        codePoint <= 0x10ffff &&
        !(codePoint >= 0xd800 && codePoint <= 0xdfff)
      ) {
        appendDecoded(String.fromCodePoint(codePoint), escapeOffset);
        index = brace ? end : end - 1;
        continue;
      }
    }
    malformedOffsets.push(escapeOffset);
    appendDecoded('\\', escapeOffset);
  }
  return {
    text: text.join(''),
    sourceOffsets,
    ...(malformedOffsets.length > 0 ? { malformedOffsets } : {}),
  };
}

export function appendMapped(target: MappedText, addition: MappedText): void {
  target.text += addition.text;
  target.sourceOffsets.push(...addition.sourceOffsets);
  if (addition.malformedOffsets !== undefined) {
    target.malformedOffsets ??= [];
    target.malformedOffsets.push(...addition.malformedOffsets);
  }
}

export function maskDynamicValues(mapped: MappedText): MappedText {
  return {
    text: mapped.text.replace(/__CINDER_DYNAMIC_\d+__/g, (marker) =>
      marker.length < 4 ? marker : `/*${' '.repeat(marker.length - 4)}*/`,
    ),
    sourceOffsets: mapped.sourceOffsets,
    ...(mapped.malformedOffsets === undefined ? {} : { malformedOffsets: mapped.malformedOffsets }),
  };
}

export function mapSlice(mapped: MappedText, start: number, end: number): MappedText {
  const slicedOffsets = mapped.sourceOffsets.slice(start, end);
  const slicedOffsetSet = new Set(slicedOffsets);
  return {
    text: mapped.text.slice(start, end),
    sourceOffsets: slicedOffsets,
    ...(mapped.malformedOffsets === undefined
      ? {}
      : {
          malformedOffsets: mapped.malformedOffsets.filter((offset) => slicedOffsetSet.has(offset)),
        }),
  };
}
