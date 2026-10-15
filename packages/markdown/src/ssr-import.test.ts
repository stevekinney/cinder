import { describe, expect, it } from 'bun:test';

const publicEntryPoint = new URL('./index.ts', import.meta.url).href;
const publicFunctions = [
  'computeLineDiff',
  'normalize',
  'contentEquals',
  'renderMarkdown',
  'renderMarkdownAsync',
  'initializeWorkerHighlighter',
  'terminateMarkdownWorker',
  'sanitizeHtml',
  'resolveTemplatePlaceholders',
  'parseMarkdownPlaceholderTokens',
  'PlaceholderTemplateError',
  'renderTemplate',
];

const source = `
  if (typeof document !== 'undefined' || typeof window !== 'undefined') {
    throw new Error('The SSR control must have no browser globals');
  }
  const markdown = await import(${JSON.stringify(publicEntryPoint)});
  for (const name of ${JSON.stringify(publicFunctions)}) {
    if (typeof markdown[name] !== 'function') throw new Error('Missing public API: ' + name);
  }
  const result = await markdown.renderMarkdownAsync('$x^2$');
  if (!result.html.includes('katex')) throw new Error('SSR fallback lost math rendering');
  if (typeof document !== 'undefined') throw new Error('SSR rendering installed a DOM shim');
  markdown.terminateMarkdownWorker();
`;

// A fresh process with no DOM is the behavior under test, so it runs once here at module scope to
// stay off the per-test clock.
const child = Bun.spawn([process.execPath, '--eval', source], {
  timeout: 120_000,
  stdout: 'pipe',
  stderr: 'pipe',
});
const [exitCode, errors] = await Promise.all([child.exited, new Response(child.stderr).text()]);

describe('@lostgradient/markdown public source entry point', () => {
  it('exposes every supported rendering API in a fresh server process', () => {
    expect(errors).toBe('');
    expect(exitCode).toBe(0);
  });
});
