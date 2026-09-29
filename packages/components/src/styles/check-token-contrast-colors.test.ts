import { describe, expect, it } from 'bun:test';
import type { TokenArms, TranslucentTokenArms } from './token-contrast-test-readers.ts';

import * as values from './check-token-contrast-test-values.ts';

const {
  AA_TEXT,
  accent,
  accentContrast,
  accentText,
  bg,
  border,
  compositeOver,
  contrastRatio,
  css,
  danger,
  dangerActive,
  dangerBg,
  dangerBorder,
  dangerContrast,
  dangerFg,
  dangerHover,
  deriveFromAccent,
  info,
  infoActive,
  infoBg,
  infoBorder,
  infoContrast,
  infoFg,
  infoHover,
  mixOklch,
  neutralBg,
  oklchToLinearSrgb,
  opacityDisabled,
  opacityFaint,
  opacityMuted,
  readTokenValue,
  readTranslucentToken,
  readOklchToken,
  success,
  successActive,
  successBg,
  successBorder,
  successContrast,
  successFg,
  successHover,
  surface,
  surfaceInset,
  text,
  translucentContrastOn,
  warning,
  warningActive,
  warningBg,
  warningBorder,
  warningContrast,
  warningFg,
  warningHover,
  wcagLuminance,
} = values;
describe('CSS shape reader', () => {
  // Retained for the assertions that are about the emitted CSS text rather than
  // a color value -- an alias must stay an alias, which resolution erases.
  it('throws on an absent token rather than silently skipping it', () => {
    expect(() => readTokenValue(':root { --a: 1; }', '--missing')).toThrow();
  });

  it('throws on an unbalanced value rather than degrading', () => {
    expect(() => readTokenValue(':root { --a: light-dark(oklch(50% 0.2 270)', '--a')).toThrow();
  });

  it('captures a multiline value as one string', () => {
    const sample =
      ':root {\n  --x: light-dark(\n    oklch(50% 0.2 270),\n    oklch(72% 0.14 270)\n  );\n}';
    expect(readTokenValue(sample, '--x')).toBe(
      'light-dark( oklch(50% 0.2 270), oklch(72% 0.14 270) )',
    );
  });
});

describe('component color token contrast and alpha', () => {
  const componentColors = [
    '--cinder-alert-info',
    '--cinder-code-block-background',
    '--cinder-file-upload-background',
    '--cinder-file-upload-progress-background',
    '--cinder-file-upload-progress-fill',
    '--cinder-kanban-column-background',
    '--cinder-kanban-card-background',
    '--cinder-tree-drop-line-color',
    '--cinder-status-dot-color',
    '--cinder-table-of-contents-link-color',
    '--cinder-table-of-contents-link-active-color',
  ];

  it('keeps every modeled component color finite in both theme arms', () => {
    for (const token of componentColors) {
      const arms = readOklchToken(token);
      for (const arm of [arms.light, arms.dark]) {
        expect(Number.isFinite(arm.l), token).toBe(true);
        expect(Number.isFinite(arm.c), token).toBe(true);
        expect(Number.isFinite(arm.h), token).toBe(true);
      }
    }
  });

  it('keeps file-upload border translucency aligned with its resolved corpus alpha', () => {
    const edge = readTranslucentToken('--cinder-file-upload-border-color');
    const borderAlpha = readTranslucentToken('--cinder-border');
    for (const arm of ['light', 'dark'] as const) {
      expect(Number.isFinite(edge[arm].l)).toBe(true);
      expect(edge[arm].alpha).toBe(borderAlpha[arm].alpha);
    }
  });

  it('keeps status-dot and table-of-contents links at text AA', () => {
    const pairs: ReadonlyArray<[string, string]> = [
      ['--cinder-status-dot-color', '--cinder-surface-inset'],
      ['--cinder-table-of-contents-link-color', '--cinder-surface-canvas'],
      ['--cinder-table-of-contents-link-active-color', '--cinder-surface-hover'],
    ];
    for (const [foregroundToken, backgroundToken] of pairs) {
      const foreground = readOklchToken(foregroundToken);
      const background = readOklchToken(backgroundToken);
      for (const arm of ['light', 'dark'] as const) {
        expect(
          contrastRatio(wcagLuminance(foreground[arm]), wcagLuminance(background[arm])),
          `${foregroundToken} on ${backgroundToken} (${arm})`,
        ).toBeGreaterThanOrEqual(AA_TEXT);
      }
    }
  });

  it('keeps explicit alpha on kanban scroll-edge and modal backdrop', () => {
    for (const token of ['--cinder-kanban-board-scroll-edge', '--cinder-modal-backdrop']) {
      const arms = readTranslucentToken(token);
      for (const arm of ['light', 'dark'] as const) {
        expect(Number.isFinite(arms[arm].alpha), `${token} ${arm}`).toBe(true);
      }
    }
  });
});

describe('accent + accent-text contrast (both arms)', () => {
  for (const arm of ['light', 'dark'] as const) {
    it(`${arm}: accent fill carries its contrast label at AA`, () => {
      const ratio = contrastRatio(wcagLuminance(accent[arm]), wcagLuminance(accentContrast[arm]));
      expect(ratio).toBeGreaterThanOrEqual(AA_TEXT);
    });

    it(`${arm}: pressed accent (l-0.11) keeps its contrast label at AA`, () => {
      const pressed = deriveFromAccent(accent[arm], -0.11);
      const ratio = contrastRatio(wcagLuminance(pressed), wcagLuminance(accentContrast[arm]));
      expect(ratio).toBeGreaterThanOrEqual(AA_TEXT);
    });

    it(`${arm}: hover accent (l-0.08) keeps its contrast label at AA`, () => {
      const hover = deriveFromAccent(accent[arm], -0.08);
      const ratio = contrastRatio(wcagLuminance(hover), wcagLuminance(accentContrast[arm]));
      expect(ratio).toBeGreaterThanOrEqual(AA_TEXT);
    });
  }

  it('accent-text clears AA on surface, bg, and inset (light arm)', () => {
    const textLuminance = wcagLuminance(accentText.light);
    for (const surfaceArms of [surface, bg, surfaceInset]) {
      expect(contrastRatio(textLuminance, wcagLuminance(surfaceArms.light))).toBeGreaterThanOrEqual(
        AA_TEXT,
      );
    }
  });

  // The active command-palette item paints accent-contrast text AND (since #461)
  // an accent-contrast keyboard-cursor ring on the accent fill. The text needs
  // AA (4.5:1); the ring needs only the WCAG 1.4.11 non-text floor (3:1). Both
  // arms must hold — the existing per-arm AA loop above already covers the text
  // pair in both arms, which is the stronger bound, so it transitively guarantees
  // the ring's 3:1 too. We therefore do NOT repeat a weaker 3:1 assertion here.
  //
  // This file gates the *token contrast*; it does not read command-item.css. The
  // CSS-source test (command-item.css.test.ts) is what pins the ring to
  // `--cinder-accent-contrast` so a swap back to a low-contrast token like
  // `--cinder-ring-color` (~1.1:1 on the accent fill) is caught there.
});

describe('status color contrast', () => {
  const DECORATIVE_BORDER = 1.4;

  it('keeps the opacity scale bounded and ordered by visual weight', () => {
    for (const [name, value] of Object.entries({ opacityDisabled, opacityMuted, opacityFaint })) {
      expect(value, name).toBeGreaterThanOrEqual(0);
      expect(value, name).toBeLessThanOrEqual(1);
    }
    expect(opacityFaint).toBeLessThan(opacityDisabled);
    expect(opacityDisabled).toBeLessThan(opacityMuted);
  });

  it('info fill carries white label at AA (light arm)', () => {
    const white = { l: 1, c: 0, h: 0 };
    expect(contrastRatio(wcagLuminance(white), wcagLuminance(info.light))).toBeGreaterThanOrEqual(
      AA_TEXT,
    );
  });

  it('every soft status tier provides readable foreground and perceptible border contrast', () => {
    // The neutral row's border aliases `--cinder-border`, which since CIN-245
    // is translucent, so its ratio has to be measured COMPOSITED over the soft
    // neutral background rather than read off the ink. The four status rows
    // stay opaque, hence the two border shapes.
    const statuses: Array<[string, TokenArms, TokenArms, TokenArms | TranslucentTokenArms]> = [
      ['neutral', neutralBg, text, border],
      ['info', infoBg, infoFg, infoBorder],
      ['success', successBg, successFg, successBorder],
      ['warning', warningBg, warningFg, warningBorder],
      ['danger', dangerBg, dangerFg, dangerBorder],
    ];
    expect(readTokenValue(css, '--cinder-status-neutral-text')).toBe('var(--cinder-text-default)');
    expect(readTokenValue(css, '--cinder-status-neutral-border')).toBe('var(--cinder-border)');
    for (const [name, background, foreground, statusBorder] of statuses) {
      for (const arm of ['light', 'dark'] as const) {
        expect(
          contrastRatio(wcagLuminance(foreground[arm]), wcagLuminance(background[arm])),
          `${name} foreground ${arm}`,
        ).toBeGreaterThanOrEqual(AA_TEXT);
        const edge = statusBorder[arm];
        expect(
          translucentContrastOn(
            { ...edge, alpha: 'alpha' in edge ? edge.alpha : 1 },
            background[arm],
          ),
          `${name} border ${arm}`,
        ).toBeGreaterThanOrEqual(DECORATIVE_BORDER);
      }
    }
  });

  it('accent status triple clears its foreground and border floors in both theme arms', () => {
    // Whitespace-normalized: these declarations are Prettier-formatted, and the
    // longer names after CIN-33 pushed them past the print width, so pinning one
    // exact spelling would assert the formatter rather than the value.
    const declaration = (property: string) => readTokenValue(css, property).replace(/\s+/g, ' ');

    expect(declaration('--cinder-accent-background')).toBe(
      'color-mix( in oklch, var(--cinder-accent-solid), var(--cinder-surface) 88% )',
    );
    expect(declaration('--cinder-accent-border')).toBe(
      'color-mix(in oklch, var(--cinder-accent-solid), transparent 60%)',
    );
    for (const arm of ['light', 'dark'] as const) {
      const background = mixOklch(accent[arm], surface[arm], 88);
      const backgroundRgb = oklchToLinearSrgb(background.l, background.c, background.h);
      const borderRgb = compositeOver(
        oklchToLinearSrgb(accent[arm].l, accent[arm].c, accent[arm].h),
        backgroundRgb,
        0.4,
      );
      expect(
        contrastRatio(wcagLuminance(accentText[arm]), wcagLuminance(background)),
        `accent foreground ${arm}`,
      ).toBeGreaterThanOrEqual(AA_TEXT);
      expect(
        contrastRatio(
          0.2126 * borderRgb[0] + 0.7152 * borderRgb[1] + 0.0722 * borderRgb[2],
          0.2126 * backgroundRgb[0] + 0.7152 * backgroundRgb[1] + 0.0722 * backgroundRgb[2],
        ),
        `accent border ${arm}`,
      ).toBeGreaterThanOrEqual(DECORATIVE_BORDER);
    }
  });

  it('info contrast label clears AA on info fill (dark arm)', () => {
    expect(
      contrastRatio(wcagLuminance(infoContrast.dark), wcagLuminance(info.dark)),
    ).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('success/warning/danger contrast labels clear AA on their fills (both arms)', () => {
    const pairs: Array<[TokenArms, TokenArms]> = [
      [success, successContrast],
      [warning, warningContrast],
      [danger, dangerContrast],
    ];
    for (const [fill, label] of pairs) {
      for (const arm of ['light', 'dark'] as const) {
        expect(
          contrastRatio(wcagLuminance(fill[arm]), wcagLuminance(label[arm])),
        ).toBeGreaterThanOrEqual(AA_TEXT);
      }
    }
  });

  it('every solid status interaction state keeps its contrast label at AA', () => {
    const pairs: Array<[string, TokenArms, TokenArms]> = [
      ['info hover', infoHover, infoContrast],
      ['info active', infoActive, infoContrast],
      ['success hover', successHover, successContrast],
      ['success active', successActive, successContrast],
      ['warning hover', warningHover, warningContrast],
      ['warning active', warningActive, warningContrast],
      ['danger hover', dangerHover, dangerContrast],
      ['danger active', dangerActive, dangerContrast],
    ];
    for (const [name, fill, label] of pairs) {
      for (const arm of ['light', 'dark'] as const) {
        expect(
          contrastRatio(wcagLuminance(fill[arm]), wcagLuminance(label[arm])),
          `${name} ${arm}`,
        ).toBeGreaterThanOrEqual(AA_TEXT);
      }
    }
  });
});
