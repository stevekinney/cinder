import { computeDiff } from '@cinder/markdown/diff';
import { computeLineDiff } from '@cinder/markdown/diff/line-diff';
import type { DiffResult } from '@cinder/markdown/diff/types';
import { isLanguageSupported } from '@cinder/markdown/rendering/highlighter';
import { getMermaidCacheSize, renderMarkdown } from '@cinder/markdown/rendering';
import type { RenderResult } from '@cinder/markdown/rendering/types';
import { parse, serialize } from '@cinder/markdown/pipeline';
import { isSafeUrl } from '@cinder/markdown/utilities/safe-url';
import { sortKeys } from '@cinder/markdown/utilities/sort-keys';

const parsed = parse('# Smoke');
if (!parsed.success) {
  throw parsed.error;
}

const serialized = serialize(parsed.ast);
const rendered: RenderResult = renderMarkdown(serialized);
const diff: DiffResult = computeDiff('# Smoke', '# Smoke test');
const lineDiff = computeLineDiff('# Smoke', '# Smoke test');
const sorted = sortKeys({ zebra: true, apple: true });

if (
  !rendered.html.includes('<h1>') ||
  diff.changes.length === 0 ||
  lineDiff.length === 0 ||
  !isSafeUrl('https://example.com') ||
  !isLanguageSupported('typescript') ||
  getMermaidCacheSize() !== 0 ||
  Object.keys(sorted)[0] !== 'apple'
) {
  throw new Error('Markdown smoke harness failed');
}
