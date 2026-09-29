/**
 * Unit tests for markdown rendering pipeline.
 *
 * DEP-49: Chat markdown rendering pipeline + sanitization.
 */

import { beforeAll, describe, expect, it } from 'bun:test';
import { initializeHighlighter } from './highlighter.js';
import { renderMarkdown } from './render.js';
describe('syntax highlighting', () => {
  // Initialize highlighter before all tests in this block
  beforeAll(async () => {
    await initializeHighlighter();
  });

  it('highlights TypeScript code blocks', () => {
    const result = renderMarkdown('```typescript\nconst x: number = 42;\n```');
    // Should have syntax highlighting styles
    expect(result.html).toContain('style=');
    // Should preserve code content
    expect(result.html).toContain('const');
    expect(result.html).toContain('42');
    // Should have data-language attribute
    expect(result.html).toContain('data-language="typescript"');
  });

  it('highlights JavaScript code blocks', () => {
    const result = renderMarkdown(
      '```javascript\nfunction greet(name) {\n  return `Hello, ${name}!`;\n}\n```',
    );
    expect(result.html).toContain('style=');
    expect(result.html).toContain('function');
    expect(result.html).toContain('greet');
    expect(result.html).toContain('data-language="javascript"');
  });

  it('highlights Python code blocks', () => {
    const result = renderMarkdown('```python\ndef hello():\n    print("world")\n```');
    expect(result.html).toContain('style=');
    expect(result.html).toContain('def');
    expect(result.html).toContain('print');
    expect(result.html).toContain('data-language="python"');
  });

  it('highlights SQL code blocks', () => {
    const result = renderMarkdown('```sql\nSELECT * FROM users WHERE id = 1;\n```');
    expect(result.html).toContain('style=');
    expect(result.html).toContain('SELECT');
    expect(result.html).toContain('data-language="sql"');
  });

  it('handles language aliases', () => {
    // ts -> typescript
    const resultTs = renderMarkdown('```ts\nconst x = 1;\n```');
    expect(resultTs.html).toContain('data-language="typescript"');

    // js -> javascript
    const resultJs = renderMarkdown('```js\nlet y = 2;\n```');
    expect(resultJs.html).toContain('data-language="javascript"');

    // py -> python
    const resultPy = renderMarkdown('```py\nx = 1\n```');
    expect(resultPy.html).toContain('data-language="python"');
  });

  it('leaves plaintext code blocks unhighlighted', () => {
    const result = renderMarkdown('```plaintext\nThis is plain text.\n```');
    // Should NOT have inline styles for highlighting
    expect(result.html).not.toMatch(/<span[^>]*style="color:/);
    // Should have the data-language attribute
    expect(result.html).toContain('data-language="plaintext"');
    // Content should be preserved
    expect(result.html).toContain('This is plain text.');
  });

  it('handles code blocks without language as plaintext', () => {
    const result = renderMarkdown('```\nNo language specified.\n```');
    // Should have pre and code tags
    expect(result.html).toContain('<pre');
    expect(result.html).toContain('<code');
    // Content should be preserved
    expect(result.html).toContain('No language specified.');
  });

  it('falls back to plaintext for unknown languages', () => {
    const result = renderMarkdown('```unknownlang\nconst x = 1;\n```');
    // Should have data-language attribute set to plaintext
    expect(result.html).toContain('data-language="plaintext"');
    // Content should still be preserved
    expect(result.html).toContain('const x = 1');
  });

  it('uses CSS variables for colors', () => {
    const result = renderMarkdown('```typescript\nconst x = "hello";\n```');
    // Should use CSS variables from design tokens
    expect(result.html).toMatch(/var\(--syntax-/);
  });

  it('preserves code content exactly', () => {
    const code = 'function test() {\n  return 42;\n}';
    const result = renderMarkdown('```javascript\n' + code + '\n```');
    // The code should be preserved (check key parts)
    expect(result.html).toContain('function');
    expect(result.html).toContain('test');
    expect(result.html).toContain('return');
    expect(result.html).toContain('42');
  });

  it('highlights multiple code blocks independently', () => {
    const markdown = `
\`\`\`typescript
const ts = "TypeScript";
\`\`\`

\`\`\`python
py = "Python"
\`\`\`
`;
    const result = renderMarkdown(markdown);
    expect(result.html).toContain('data-language="typescript"');
    expect(result.html).toContain('data-language="python"');
    expect(result.html).toContain('TypeScript');
    expect(result.html).toContain('Python');
  });

  it('handles diff highlighting', () => {
    const result = renderMarkdown('```diff\n+ added line\n- removed line\n```');
    expect(result.html).toContain('data-language="diff"');
    expect(result.html).toContain('added line');
    expect(result.html).toContain('removed line');
  });

  it('highlights Svelte code blocks', () => {
    const result = renderMarkdown('```svelte\n<script>\n  let count = 0;\n</script>\n```');
    expect(result.html).toContain('style=');
    expect(result.html).toContain('data-language="svelte"');
    expect(result.html).toContain('count');
  });

  it('sanitizes highlighted output', () => {
    // Ensure XSS payloads don't survive highlighting + sanitization
    const result = renderMarkdown('```html\n<script>alert("xss")</script>\n```');
    // Should not contain raw script tags
    expect(result.html).not.toMatch(/<script>/);
    // Content should be preserved (escaped) - the exact encoding varies
    // (could be &lt; or &#x3C;) but must NOT be double-encoded &#x26;#x3C;
    expect(result.html).toContain('script');
    // The key assertion: no executable script tag
    expect(result.html).not.toContain('<script>alert');
    // Must not double-encode: Shiki outputs &#x3C; for < and rehype-stringify
    // must not further encode the & to produce &#x26;#x3C;
    expect(result.html).not.toContain('&#x26;#x3C;');
  });

  it('does not double-encode ampersand in highlighted code', () => {
    const result = renderMarkdown('```javascript\nconst x = a && b;\n```');
    // & in source → Shiki may emit &#x26; → must decode to & → rehype-stringify re-encodes as &amp;
    // The final output must contain &amp; for the ampersand, never &#x26;
    expect(result.html).not.toContain('&#x26;');
    expect(result.html).toContain('&amp;');
  });
});
