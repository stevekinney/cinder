/**
 * Regression test for COR-465: the dark theme's elevation shadows (`shadow.small`,
 * `shadow.medium`, `shadow.large`) must resolve to black, not the glowing white
 * the token source previously carried. This reads `dark.tokens.json` directly —
 * a value assertion against the token source itself, not a computed-style or DOM
 * check — so a regression is caught before token generation ever runs.
 *
 * `shadow.overlay` is intentionally out of scope for the color change (it was
 * already black) and is asserted unchanged here as a guard against accidental
 * drift while editing the other three layers.
 */

import { expect, test } from 'bun:test';
import { join } from 'node:path';

interface ShadowColor {
  colorSpace: string;
  components: number[];
  alpha: number;
}

interface ShadowLayer {
  color: ShadowColor;
  offsetX: { value: number; unit: string };
  offsetY: { value: number; unit: string };
  blur: { value: number; unit: string };
  spread: { value: number; unit: string };
}

interface DarkShadowTokens {
  shadow: Record<'small' | 'medium' | 'large' | 'overlay', { $value: ShadowLayer[] }>;
}

const DARK_TOKENS_PATH = join(import.meta.dir, 'themes/dark.tokens.json');

const BLACK: Pick<ShadowColor, 'colorSpace' | 'components'> = {
  colorSpace: 'oklch',
  components: [0, 0, 0],
};

/** Each layer's two box-shadow arms, keyed by their existing (unchanged) alpha. */
const EXPECTED_LAYER_ALPHAS = {
  small: [0.09, 0.05],
  medium: [0.09, 0.06],
  large: [0.11, 0.07],
} as const;

const EXPECTED_OVERLAY_VALUE: ShadowLayer[] = [
  {
    color: { colorSpace: 'oklch', components: [0, 0, 0], alpha: 0.45 },
    offsetX: { value: 0, unit: 'px' },
    offsetY: { value: 10, unit: 'px' },
    blur: { value: 15, unit: 'px' },
    spread: { value: -3, unit: 'px' },
  },
  {
    color: { colorSpace: 'oklch', components: [0, 0, 0], alpha: 0.32 },
    offsetX: { value: 0, unit: 'px' },
    offsetY: { value: 4, unit: 'px' },
    blur: { value: 6, unit: 'px' },
    spread: { value: -4, unit: 'px' },
  },
];

async function readDarkTokens(): Promise<DarkShadowTokens> {
  return (await Bun.file(DARK_TOKENS_PATH).json()) as DarkShadowTokens;
}

test.each(Object.entries(EXPECTED_LAYER_ALPHAS))(
  'dark theme shadow.%s resolves both layers to black at the existing alpha',
  async (layer, alphas) => {
    const dark = await readDarkTokens();
    const key = layer as keyof typeof EXPECTED_LAYER_ALPHAS;
    const colors = dark.shadow[key].$value.map((entry) => entry.color);

    expect(colors).toEqual(alphas.map((alpha) => ({ ...BLACK, alpha })));
  },
);

test('dark theme shadow.overlay is unchanged', async () => {
  const dark = await readDarkTokens();

  expect(dark.shadow.overlay.$value).toEqual(EXPECTED_OVERLAY_VALUE);
});
