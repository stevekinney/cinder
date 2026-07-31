/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';
import { compileModule } from 'svelte/compiler';

import {
  applyAnchoredOverlayMaxBlockSize,
  getAnchoredOverlayAvailableHeightStyle,
  getAnchoredOverlayMaxBlockSizeStyle,
  getAnchoredOverlayWidthStyle,
  isAnchoredOverlayWriteCurrent,
} from './anchored-overlay.svelte.ts';

describe('anchored overlay width styles', () => {
  test('match-anchor locks the floating surface to the anchor width', () => {
    expect(getAnchoredOverlayWidthStyle('match-anchor', { width: 144 })).toBe(
      'min-inline-size: 144px; inline-size: 144px;',
    );
  });

  test('match-anchor omits width when the anchor has no measurable width', () => {
    expect(getAnchoredOverlayWidthStyle('match-anchor', { width: 0 })).toBe('');
  });

  test('menu uses compact intrinsic sizing bounded by the viewport', () => {
    const style = getAnchoredOverlayWidthStyle('menu', { width: 320 });
    expect(style).toContain('inline-size: max-content');
    expect(style).toContain('min-inline-size: min(12rem');
    expect(style).toContain('max-inline-size: min(24rem');
  });

  test('content keeps a bounded max width without forcing intrinsic menu sizing', () => {
    expect(getAnchoredOverlayWidthStyle('content', { width: 320 })).toBe(
      'max-inline-size: min(28rem, calc(100vw - var(--cinder-space-4)));',
    );
  });

  test('none leaves width entirely to the component stylesheet', () => {
    expect(getAnchoredOverlayWidthStyle('none', { width: 320 })).toBe('');
  });

  test('available height style clamps negative space and preserves measured space', () => {
    expect(getAnchoredOverlayAvailableHeightStyle(320)).toBe('320px');
    expect(getAnchoredOverlayAvailableHeightStyle(-1)).toBe('0px');
  });

  test('applies the available-height cap during measurement and supports cleanup', () => {
    const panel = {
      style: {
        maxBlockSize: '',
        removeProperty(property: string) {
          if (property === 'max-block-size') this.maxBlockSize = '';
        },
      },
    } as unknown as HTMLElement;

    expect(getAnchoredOverlayMaxBlockSizeStyle(320, '24rem')).toBe('min(24rem, 320px)');
    expect(applyAnchoredOverlayMaxBlockSize(panel, 320, '24rem')).toBe('min(24rem, 320px)');
    expect(panel.style.maxBlockSize).toBe('min(24rem, 320px)');

    panel.style.removeProperty('max-block-size');
    expect(panel.style.maxBlockSize).toBe('');
  });

  test('rejects stale or cancelled positioning sessions before DOM writes', () => {
    expect(isAnchoredOverlayWriteCurrent(3, 3, false)).toBe(true);
    expect(isAnchoredOverlayWriteCurrent(2, 3, false)).toBe(false);
    expect(isAnchoredOverlayWriteCurrent(3, 3, true)).toBe(false);
  });

  test('server compilation omits Floating UI runtime imports', async () => {
    const sourcePath = `${import.meta.dir}/anchored-overlay.svelte.ts`;
    const source = await Bun.file(sourcePath).text();
    expect(source).toContain('sizeMiddleware({');
    expect(source).toContain('padding: shiftPadding');
    const moduleSource = new Bun.Transpiler({ loader: 'ts' }).transformSync(source);
    const result = compileModule(moduleSource, {
      filename: sourcePath,
      generate: 'server',
      dev: false,
    });

    expect(result.js.code).not.toContain('@floating-ui/dom');
  });
});
