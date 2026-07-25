import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const stylesheet = readFileSync(new URL('./feature-section.css', import.meta.url), 'utf8');

describe('FeatureSection responsive layout', () => {
  test('keeps the split breakpoint aligned with HeroSection and bounds media', () => {
    expect(stylesheet).toContain('@container cinder-feature-section (max-width: 64rem)');
    expect(stylesheet).toContain('@container cinder-feature-section (min-width: 64rem)');
    expect(stylesheet).toContain('max-block-size: 32rem');
    expect(stylesheet).toContain('overflow: auto');
  });
});
