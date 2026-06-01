import { describe, expect, test } from 'bun:test';

import {
  classifyLine,
  FEATURE_PROBES,
  scan,
  VIEWPORT_WIDTH_MEDIA,
} from './check-platform-features.ts';

function probeIndex(feature: string): number {
  const index = FEATURE_PROBES.findIndex((probe) => probe.feature === feature);
  if (index === -1) throw new Error(`no probe for ${feature}`);
  return index;
}

describe('classifyLine — feature detection', () => {
  test('detects container queries in a .css file', () => {
    const { matchedProbeIndices } = classifyLine(
      'components/x/x.css',
      '  @container cinder-x (max-width: 30rem) {',
    );
    expect(matchedProbeIndices).toContain(probeIndex('container queries'));
  });

  test('detects CSS features authored inline in a .svelte <style> block', () => {
    const { matchedProbeIndices } = classifyLine(
      'components/x/x.svelte',
      '    content-visibility: auto;',
    );
    expect(matchedProbeIndices).toContain(probeIndex('content-visibility'));
  });

  test('<dialog> is only probed in .svelte, not .css', () => {
    expect(classifyLine('components/x/x.svelte', '<dialog>').matchedProbeIndices).toContain(
      probeIndex('<dialog>'),
    );
    expect(classifyLine('components/x/x.css', '<dialog>').matchedProbeIndices).not.toContain(
      probeIndex('<dialog>'),
    );
  });

  test('Popover API is probed in .svelte/.ts, not .css', () => {
    expect(classifyLine('components/x/x.svelte', 'el.showPopover()').matchedProbeIndices).toContain(
      probeIndex('Popover API'),
    );
    expect(
      classifyLine('components/x/overlay.ts', 'node.showPopover()').matchedProbeIndices,
    ).toContain(probeIndex('Popover API'));
  });
});

describe('VIEWPORT_WIDTH_MEDIA — the viewport vs container distinction', () => {
  test('flags a viewport @media width query', () => {
    expect(
      classifyLine('components/x/x.css', '  @media (min-width: 640px) {').isViewportWidthMedia,
    ).toBe(true);
  });

  test('does NOT flag a @container width query (the preferred primitive)', () => {
    expect(
      classifyLine('components/x/x.css', '  @container cinder-x (max-width: 30rem) {')
        .isViewportWidthMedia,
    ).toBe(false);
  });

  test('does NOT flag prefers-reduced-motion or other non-width media', () => {
    expect(VIEWPORT_WIDTH_MEDIA.test('@media (prefers-reduced-motion: reduce) {')).toBe(false);
    expect(VIEWPORT_WIDTH_MEDIA.test('@media (forced-colors: active) {')).toBe(false);
  });

  test('does NOT flag a plain max-width sizing declaration', () => {
    expect(classifyLine('components/x/x.css', '  max-width: 16rem;').isViewportWidthMedia).toBe(
      false,
    );
  });

  test('only flags style files', () => {
    expect(
      classifyLine('components/x/x.ts', '@media (min-width: 640px)').isViewportWidthMedia,
    ).toBe(false);
  });
});

describe('scan — live inventory against the real source tree', () => {
  test('reports usage for every classified probe and a deterministic viewport-flag set', async () => {
    const { counts, viewportFlags } = await scan();

    // Every probe in the policy table is represented in the report.
    expect(counts.map((entry) => entry.feature).toSorted()).toEqual(
      FEATURE_PROBES.map((probe) => probe.feature).toSorted(),
    );

    // Tier-1 baselines the library genuinely relies on must show real usage,
    // so a refactor that accidentally strips them is visible.
    const byFeature = new Map(counts.map((entry) => [entry.feature, entry.count]));
    expect(byFeature.get('@layer')!).toBeGreaterThan(0);
    expect(byFeature.get('container queries')!).toBeGreaterThan(0);
    expect(byFeature.get('<dialog>')!).toBeGreaterThan(0);
    expect(byFeature.get('inert')!).toBeGreaterThan(0);

    // Every flagged viewport query is a real @media(width) line in a style file —
    // the report never invents flags.
    for (const flag of viewportFlags) {
      expect(flag.filePath).toMatch(/\.(css|svelte)$/);
      expect(VIEWPORT_WIDTH_MEDIA.test(flag.line)).toBe(true);
    }
  });
});
