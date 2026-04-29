/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../test/happy-dom.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: CodeBlock } = await import('./code-block.svelte');

describe('CodeBlock', () => {
  test('renders code in a <pre><code> pair', () => {
    const { container } = render(CodeBlock, { code: 'const x = 1;' });
    const pre = container.querySelector('pre');
    expect(pre).not.toBeNull();
    expect(pre?.querySelector('code')?.textContent).toBe('const x = 1;');
  });

  test('language prop renders an uppercase language label', () => {
    const { container } = render(CodeBlock, { code: 'const x', language: 'ts' });
    const label = container.querySelector('.cinder-code-block__language');
    expect(label?.textContent?.trim()).toBe('ts');
  });

  test('header is omitted when neither language nor copyable is set', () => {
    const { container } = render(CodeBlock, { code: 'plain' });
    expect(container.querySelector('.cinder-code-block__header')).toBeNull();
  });

  test('copyable=true renders a copy button in the header', () => {
    const { container } = render(CodeBlock, { code: 'x', copyable: true });
    expect(container.querySelector('.cinder-code-block__header')).not.toBeNull();
    expect(container.querySelector('.cinder-copy-button')).not.toBeNull();
  });
});
