import { expect, test } from 'bun:test';
import { join } from 'node:path';

import * as cinder from '@lostgradient/cinder';

const tokenExports = {
  tokenIndex: 'index.json',
  tokenResolver: 'cinder.resolver.json',
  TOKEN_REGISTRY: 'registry.generated.json',
  motionDefaultTokens: 'modes/motion-default.tokens.json',
  motionForcedReducedTokens: 'modes/motion-forced-reduced.tokens.json',
  motionReducedTokens: 'modes/motion-reduced.tokens.json',
  colorTokens: 'sets/colors.tokens.json',
  componentTokens: 'sets/components.tokens.json',
  foundationTokens: 'sets/foundation.tokens.json',
  semanticTokens: 'sets/semantic.tokens.json',
  darkThemeTokens: 'themes/dark.tokens.json',
  lightThemeTokens: 'themes/light.tokens.json',
  resolvedDarkTokens: 'resolved/dark.json',
  resolvedDarkReducedMotionTokens: 'resolved/dark-reduced-motion.json',
  resolvedLightTokens: 'resolved/light.json',
  resolvedLightReducedMotionTokens: 'resolved/light-reduced-motion.json',
};

test.each(Object.entries(tokenExports))(
  'the package root exposes complete %s data',
  async (name, file) => {
    const expected: unknown = await Bun.file(join(import.meta.dir, 'tokens', file)).json();
    expect(Reflect.get(cinder, name)).toEqual(expected);
  },
);

test('the token index identifies supported root exports without package subpaths', () => {
  expect(cinder.tokenIndex.package).toBe('@lostgradient/cinder');
  expect(cinder.tokenIndex.resolver).toBe('tokenResolver');
  expect(cinder.tokenIndex.registry).toBe('TOKEN_REGISTRY');
  expect(cinder.tokenIndex.sources).toHaveLength(9);
  expect(cinder.tokenIndex.resolvedContexts).toHaveLength(4);
  for (const source of cinder.tokenIndex.sources) {
    expect(Reflect.get(tokenExports, source.exportName)).toBe(source.file);
    expect(Object.hasOwn(cinder, source.exportName)).toBe(true);
  }
  for (const context of cinder.tokenIndex.resolvedContexts) {
    expect(Reflect.get(tokenExports, context.exportName)).toBe(`resolved/${context.name}.json`);
    expect(Object.hasOwn(cinder, context.exportName)).toBe(true);
  }
});

test('registry lookups and optional facets retain their public types', () => {
  const key: string = 'space.4';
  const property: string | undefined = cinder.TOKEN_REGISTRY.pathToCssProperty[key];
  expect(property).toBe('--cinder-space-4');
  const component: string | undefined = cinder.TOKEN_REGISTRY.entries[0]?.component;
  expect(component).toBeUndefined();
});
