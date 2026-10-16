import { describe, expect, it } from 'bun:test';

import {
  CINDER_BASE,
  CONTRAST_PAIRINGS,
  contrastRatio,
  evaluateThemeProperties,
  measurePairing,
  requiredContrast,
  wcagLuminance,
} from '../tokens/runtime/index.ts';
import {
  readOklchToken,
  readTranslucentToken,
  translucentContrastOn,
} from './token-contrast-test-readers.ts';

const evaluation = evaluateThemeProperties({
  revision: 1,
  resolver: CINDER_BASE.resolver,
  documents: CINDER_BASE.documents,
});
if (!evaluation.ok) throw new Error('The shipped Cinder base does not evaluate.');
const contexts = evaluation.contexts;

describe('the shared pairing table over the shipped theme', () => {
  it('evaluates all six contexts and keeps every pairing id unique', () => {
    expect(contexts).toHaveLength(6);
    expect(new Set(CONTRAST_PAIRINGS.map((pairing) => pairing.id)).size).toBe(
      CONTRAST_PAIRINGS.length,
    );
    expect(CONTRAST_PAIRINGS.length).toBeGreaterThan(100);
  });

  for (const context of contexts) {
    const properties = evaluation.properties[context.id]!;
    const theme = context.theme === 'dark' ? 'dark' : 'light';

    it(`${context.id}: every pairing is measurable`, () => {
      for (const pairing of CONTRAST_PAIRINGS) {
        const measurement = measurePairing(pairing, properties, { theme });
        expect(measurement.status, `${pairing.id}: ${JSON.stringify(measurement)}`).toBe(
          'measured',
        );
      }
    });

    it(`${context.id}: every WCAG pairing meets its unrounded threshold`, () => {
      for (const pairing of CONTRAST_PAIRINGS.filter((entry) => entry.scope === 'wcag')) {
        const required = requiredContrast(pairing.classification);
        if (required === null) continue;
        const measurement = measurePairing(pairing, properties, { theme });
        if (measurement.status !== 'measured') continue;
        expect(measurement.ratio, `${pairing.id} (${pairing.foreground})`).toBeGreaterThanOrEqual(
          required,
        );
      }
    });

    it(`${context.id}: every Cinder advisory floor holds`, () => {
      for (const pairing of CONTRAST_PAIRINGS.filter((entry) => entry.scope !== 'wcag')) {
        const measurement = measurePairing(pairing, properties, { theme });
        if (measurement.status !== 'measured' || pairing.advisoryFloor === undefined) continue;
        expect(measurement.ratio, pairing.id).toBeGreaterThanOrEqual(pairing.advisoryFloor);
      }
    });
  }

  it('agrees with the resolved-value math the suites above use', () => {
    const properties = evaluation.properties['light/default']!;
    const text = readOklchToken('--cinder-text-default');
    const surface = readOklchToken('--cinder-surface');
    const byId = (id: string) => CONTRAST_PAIRINGS.find((pairing) => pairing.id === id)!;
    const textOnSurface = measurePairing(byId('text:default:surface'), properties, {
      theme: 'light',
    });
    expect(textOnSurface.status).toBe('measured');
    if (textOnSurface.status === 'measured') {
      expect(textOnSurface.ratio).toBeCloseTo(
        contrastRatio(wcagLuminance(text.light), wcagLuminance(surface.light)),
        3,
      );
    }
    const border = readTranslucentToken('--cinder-border');
    const borderOnSurface = measurePairing(byId('border:control:surface'), properties, {
      theme: 'light',
    });
    expect(borderOnSurface.status).toBe('measured');
    if (borderOnSurface.status === 'measured') {
      expect(borderOnSurface.ratio).toBeCloseTo(
        translucentContrastOn(border.light, surface.light),
        2,
      );
    }
  });
});
