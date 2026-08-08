import { describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  collectPropConventionViolations,
  collectResolvedSurfaceViolations,
  createPropsProgram,
} from './check-prop-conventions';

describe('check-prop-conventions', () => {
  test('flags defaultValue props', () => {
    const violations = collectPropConventionViolations(
      'export type Props = { defaultValue?: string };',
    );

    expect(violations.map((violation) => violation.propName)).toEqual(['defaultValue']);
  });

  test('flags show, allow, and use boolean prefixes', () => {
    const source = `
      export type Props = {
        showSearch?: boolean;
        allowCustomValue?: boolean;
        useNativeShare?: boolean;
      };
    `;

    expect(collectPropConventionViolations(source).map((violation) => violation.propName)).toEqual([
      'showSearch',
      'allowCustomValue',
      'useNativeShare',
    ]);
  });

  test('flags lowercase custom callback names and React-style onClick', () => {
    const source = `
      export type Props = {
        onsearchchange?: (value: string) => void;
        onClick?: () => void;
      };
    `;

    expect(collectPropConventionViolations(source).map((violation) => violation.propName)).toEqual([
      'onsearchchange',
      'onClick',
    ]);
  });

  test('flags partially capitalized multiword callback names', () => {
    const source = `
      export type Props = {
        onLoadmore?: () => void;
        onSelectall?: (next: boolean) => void;
        onFilterchange?: (value: string) => void;
      };
    `;

    expect(collectPropConventionViolations(source).map((violation) => violation.propName)).toEqual([
      'onLoadmore',
      'onSelectall',
      'onFilterchange',
    ]);
  });

  test('allows native lowercase handlers and custom camelCase callbacks', () => {
    const source = `
      export type Props = {
        onclick?: () => void;
        onchange?: () => void;
        onSearchChange?: (value: string) => void;
        onValueChangeRequest?: (value: string) => string;
      };
    `;

    expect(collectPropConventionViolations(source)).toEqual([]);
  });

  test('treats banned names as exact prop names, not substrings', () => {
    const source = `
      export type Props = {
        monochrome?: boolean;
        monospaceToken?: '--cinder-font-mono';
        monospacePlatformFamily?: 'ui-monospace' | 'SFMono-Regular' | 'SF Mono' | 'Liberation Mono' | 'monospace';
      };
    `;

    expect(collectPropConventionViolations(source)).toEqual([]);
  });

  test('ignores non-prop helper types and nested domain model fields', () => {
    const source = `
      export type HelperModel = {
        component?: string;
        defaultValue?: string;
      };

      export type CardProps = {
        options?: {
          component?: string;
          defaultValue?: string;
        };
      };

      export interface CardSchemaProps {
        component?: string;
      }
    `;

    expect(collectPropConventionViolations(source)).toEqual([]);
  });
});

describe('check-prop-conventions type-aware surface pass', () => {
  // ONE program over all fixtures — building a ts.Program per assertion costs
  // ~10s each and times the tests out; the checker's behavior is per-file, so
  // one shared build loses nothing. Fixtures live under src/components so the
  // checker attributes their declarations (elsewhere is skipped as native).
  const FIXTURES: Record<string, string> = {
    'value-callback': 'export type ValueCallbackProps = { onchange?: (value: string) => void };',
    'event-handler': 'export type EventHandlerProps = { onclick?: (event: MouseEvent) => void };',
    'fence-arm': 'export type FenceArmProps = { onclick?: undefined };',
    'hidden-helper': [
      'type Helper = { onchange?: (value: string) => void };',
      'export type HiddenHelperProps = Helper & { id?: string };',
    ].join('\n'),
    'banned-name': 'export type BannedNameProps = { hideLabel?: boolean };',
  };

  function buildViolationsByFixture(): Map<
    string,
    ReturnType<typeof collectResolvedSurfaceViolations>
  > {
    const root = mkdtempSync(join(import.meta.dir, '..', 'src', 'components', '.tmp-propcheck-'));
    try {
      const fixturePaths = new Map<string, string>();
      for (const [name, source] of Object.entries(FIXTURES)) {
        const componentDirectory = join(root, name);
        mkdirSync(componentDirectory, { recursive: true });
        const fixturePath = join(componentDirectory, `${name}.types.ts`);
        writeFileSync(fixturePath, source);
        fixturePaths.set(name, fixturePath);
      }
      const allPaths = [...fixturePaths.values()];
      const program = createPropsProgram(allPaths);
      const byFixture = new Map<string, ReturnType<typeof collectResolvedSurfaceViolations>>();
      for (const [name, fixturePath] of fixturePaths) {
        byFixture.set(name, collectResolvedSurfaceViolations(program, [fixturePath]));
      }
      return byFixture;
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }

  const violationsByFixture = buildViolationsByFixture();

  test('flags a lowercase native-named handler whose first parameter is a value', () => {
    const violations = violationsByFixture.get('value-callback') ?? [];
    expect(violations).toHaveLength(1);
    expect(violations[0]?.propName).toBe('onchange');
    expect(violations[0]?.message).toContain('does not extend Event');
  });

  test('passes a lowercase native-named handler whose first parameter extends Event', () => {
    expect(violationsByFixture.get('event-handler')).toEqual([]);
  });

  test('passes an undefined-only discriminated-union fence arm', () => {
    expect(violationsByFixture.get('fence-arm')).toEqual([]);
  });

  test('flags an offender hidden behind a non-exported helper type', () => {
    const violations = violationsByFixture.get('hidden-helper') ?? [];
    expect(violations).toHaveLength(1);
    expect(violations[0]?.propName).toBe('onchange');
  });

  test('flags a banned name resolved through the surface', () => {
    const violations = violationsByFixture.get('banned-name') ?? [];
    expect(violations.some((violation) => violation.message.includes('labelVisible'))).toBe(true);
  });
});
