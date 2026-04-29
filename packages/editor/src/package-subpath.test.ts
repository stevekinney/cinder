import { describe, expect, it } from 'bun:test';

import { sanitizeHtml } from '@cinder/editor/sanitize-html';
import {
  parsePlaceholderTokens,
  resolveTemplatePlaceholders,
} from '@cinder/editor/template-placeholders';
import { renderTemplate } from '@cinder/editor/template-render';
import { createDocFromMarkdown, debugDocStructure } from '@cinder/editor/test-utilities';

describe('@cinder/editor subpath exports', () => {
  it('resolves every documented package subpath through the export map', () => {
    expect(typeof sanitizeHtml).toBe('function');
    expect(typeof parsePlaceholderTokens).toBe('function');
    expect(typeof resolveTemplatePlaceholders).toBe('function');
    expect(typeof renderTemplate).toBe('function');
    expect(typeof createDocFromMarkdown).toBe('function');
    expect(typeof debugDocStructure).toBe('function');
  });
});
