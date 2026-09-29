import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { css, readTokenValue } from './check-token-contrast-test-values.ts';

describe('--cinder-type-tab-size (declaration, value, usage)', () => {
  it('is declared in tokens-base.css', () => {
    expect(() => readTokenValue(css, '--cinder-type-tab-size')).not.toThrow();
  });

  it('resolves to a positive integer', () => {
    const value = readTokenValue(css, '--cinder-type-tab-size');
    expect(value).toMatch(/^\d+$/);
    expect(Number.parseInt(value, 10)).toBeGreaterThan(0);
  });

  it('is consumed by every surface it documents itself as backing', () => {
    const consumers = [
      '../components/input/input.css',
      '../components/textarea/textarea.css',
      '../components/code-block/code-block.css',
    ];
    for (const relativePath of consumers) {
      const consumerCss = readFileSync(
        join(dirname(fileURLToPath(import.meta.url)), relativePath),
        'utf8',
      );
      expect(consumerCss).toContain('var(--cinder-type-tab-size)');
    }
  });
});
