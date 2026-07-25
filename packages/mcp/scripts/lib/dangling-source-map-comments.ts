/**
 * Strip `//# sourceMappingURL=...` comments that reference a `.map` file the
 * publish `files` allowlist excludes from the tarball. `scripts/build.ts`
 * compiles with `sourcemap: 'external'`, so every emitted `dist/**\/*.js`
 * carries one of these comments — left in place, the published package would
 * ship scripts pointing at source maps that don't exist.
 *
 * This is a deliberate copy of `packages/components/scripts/pack-for-publish.ts`'s
 * `getSourceMapReferences`/`stripDanglingSourceMapUrlComments`, not a shared
 * import — `tsconfig.check.json`'s `rootDir` rejects importing a file from
 * outside `packages/markdown/`, and this repo's existing convention is for
 * each published package (`markdown`, `cinder`, `chat`) to carry its own
 * `pack-for-publish.ts` rather than share one across package boundaries.
 */

type SourceMapReference = {
  line: number;
  reference: string;
};

type SourceMapStripResult = {
  text: string;
  strippedCount: number;
};

function isResolvableRelativeSourceMapReference(reference: string): boolean {
  if (!reference.endsWith('.map')) return false;
  if (reference.startsWith('data:')) return false;
  if (reference.startsWith('file:')) return false;
  return !/^[a-z]+:\/\//iu.test(reference);
}

export function getSourceMapReferences(content: string): SourceMapReference[] {
  const references: SourceMapReference[] = [];
  const lines = content.split('\n');
  for (const [index, line] of lines.entries()) {
    const lineCommentMatch = line.match(/^\s*\/\/[#@]\s*sourceMappingURL=([^\s]+)\s*$/u);
    if (lineCommentMatch?.[1] && isResolvableRelativeSourceMapReference(lineCommentMatch[1])) {
      references.push({ line: index + 1, reference: lineCommentMatch[1] });
      continue;
    }

    const blockCommentMatch = line.match(/^\s*\/\*#\s*sourceMappingURL=([^*\s]+)\s*\*\/\s*$/u);
    if (blockCommentMatch?.[1] && isResolvableRelativeSourceMapReference(blockCommentMatch[1])) {
      references.push({ line: index + 1, reference: blockCommentMatch[1] });
    }
  }
  return references;
}

export function stripDanglingSourceMapUrlComments(
  text: string,
  hasSourceMap: (reference: string) => boolean,
): SourceMapStripResult {
  let strippedCount = 0;
  const outputLines: string[] = [];
  const lines = text.split('\n');
  const sourceMapReferencesByLine = new Map(
    getSourceMapReferences(text).map((sourceMapReference) => [
      sourceMapReference.line,
      sourceMapReference,
    ]),
  );
  for (const [index, line] of lines.entries()) {
    const sourceMapReference = sourceMapReferencesByLine.get(index + 1);
    if (sourceMapReference && !hasSourceMap(sourceMapReference.reference)) {
      strippedCount += 1;
      continue;
    }

    outputLines.push(line);
  }

  const outputText = outputLines.join('\n');
  if (outputText.length === 0) {
    return { text: outputText, strippedCount };
  }
  if (!text.endsWith('\n') && outputText.endsWith('\n')) {
    return { text: outputText.slice(0, -1), strippedCount };
  }
  if (text.endsWith('\n') && !outputText.endsWith('\n')) {
    return { text: `${outputText}\n`, strippedCount };
  }
  return { text: outputText, strippedCount };
}
