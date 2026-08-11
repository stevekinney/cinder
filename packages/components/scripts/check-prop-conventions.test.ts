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

  test('defers show/allow/use prefixes to the type-aware pass', () => {
    const source = `
      export type Props = {
        showSearch?: boolean;
        allowCustomValue?: boolean;
        useNativeShare?: boolean;
        hideDelay?: number;
      };
    `;

    // Whether a polarity prefix is a violation depends on the prop's resolved
    // type, so the syntactic pass leaves every prefixed name to the type-aware
    // surface scan.
    expect(collectPropConventionViolations(source)).toEqual([]);
  });

  test('flags React-style onClick; lowercase handlers are deferred to the type-aware pass', () => {
    const source = `
      export type Props = {
        onsearchchange?: (value: string) => void;
        onClick?: () => void;
      };
    `;

    // `onsearchchange` is a type question (is it a native passthrough whose
    // first parameter extends Event?), so the syntactic pass leaves it to the
    // type-aware surface scan.
    expect(collectPropConventionViolations(source).map((violation) => violation.propName)).toEqual([
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
        monotonic?: boolean;
        monospaceToken?: '--cinder-font-mono';
        monospacePlatformFamily?: 'ui-monospace' | 'SFMono-Regular' | 'SF Mono' | 'Liberation Mono' | 'monospace';
      };
    `;

    expect(collectPropConventionViolations(source)).toEqual([]);
  });

  test('flags the retired monochrome name with the monospace redirect', () => {
    const source = `
      export type Props = {
        monochrome?: boolean;
      };
    `;

    const violations = collectPropConventionViolations(source);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.propName).toBe('monochrome');
    expect(violations[0]?.message).toContain('monospace');
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
    'pointer-forward':
      'export type PointerForwardProps = { onpointerdown?: (event: PointerEvent) => void; onwheel?: (event: WheelEvent) => void };',
    'non-callable':
      'export type NonCallableProps = { onchange?: string; onmark?: ((event: Event) => void) | string };',
    'boolean-prefix':
      'export type BooleanPrefixProps = { showSearch?: boolean; useNativeShare?: boolean | undefined };',
    'non-boolean-prefix':
      'export type NonBooleanPrefixProps = { hideDelay?: number; showCount?: number; disableReason?: string };',
    'boolean-fence-arm': 'export type BooleanFenceArmProps = { showSearch?: undefined };',
    'opaque-prefix':
      'export type OpaquePrefixProps = { showSearch?: unknown; useNativeShare?: any };',
    'generic-prefix':
      'export type GenericPrefixProps<Item extends { id: string }, Flag extends boolean, Loose> = { showItem?: Item; showFlag?: Flag; showLoose?: Loose };',
    'wide-constraint':
      'export type WideConstraintProps<Empty extends {}, Any extends unknown, Union extends string | boolean> = { showEmpty?: Empty; showAny?: Any; showUnion?: Union };',
    'narrow-constraint':
      'export type NarrowConstraintProps<Countable extends number, Named extends { id: string }, Callable extends () => void> = { showCountable?: Countable; showNamed?: Named; showCallable?: Callable };',
    // Object shapes a primitive boolean is still assignable to: the wrapper
    // interface, and a structural constraint satisfied by Boolean.prototype.
    'boolean-wrapper':
      'export type BooleanWrapperProps<Valued extends { valueOf(): boolean }> = { showWrapped?: Boolean; showValued?: Valued };',
    // Deferred types: nothing is assignable to either while the type argument
    // is unresolved, but `Deferred<true>` / `Indexed<{ flag: boolean }>` both
    // expose a boolean.
    'deferred-type':
      'export type DeferredTypeProps<Flag extends boolean, Bag extends { flag: boolean }> = { showState?: Flag extends true ? boolean : number; showIndexed?: Bag["flag"] };',
    // Wrappers a boolean survives but plain assignability does not see:
    // NoInfer's substitution, and a branded intersection.
    'wrapped-boolean':
      'declare const brand: unique symbol;\nexport type WrappedBooleanProps<Flag extends boolean> = { showDeferredFlag?: NoInfer<Flag>; showBranded?: boolean & { readonly [brand]: true } };',
    // `{}` admits a boolean on its own, but it constrains nothing — the
    // intersection is still a number.
    'branded-non-boolean':
      'export type BrandedNonBooleanProps = { showCount?: number & {}; showTag?: string & { readonly __tag: "id" } };',
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

  test('passes native handlers outside any name allowlist when the signature is a passthrough', () => {
    expect(violationsByFixture.get('pointer-forward')).toEqual([]);
  });

  test('flags non-callable and mixed callable/non-callable lowercase on* props', () => {
    const violations = violationsByFixture.get('non-callable') ?? [];
    expect(violations.map((violation) => violation.propName).toSorted()).toEqual([
      'onchange',
      'onmark',
    ]);
  });

  test('flags a polarity prefix on a boolean-valued prop', () => {
    const violations = violationsByFixture.get('boolean-prefix') ?? [];
    expect(violations.map((violation) => violation.propName).toSorted()).toEqual([
      'showSearch',
      'useNativeShare',
    ]);
    expect(
      violations.every((violation) => violation.message.includes('adjective/state names')),
    ).toBe(true);
  });

  test('passes a polarity-prefixed name whose resolved type is not boolean', () => {
    expect(violationsByFixture.get('non-boolean-prefix')).toEqual([]);
  });

  test('passes an undefined-only fence arm on a polarity-prefixed name', () => {
    expect(violationsByFixture.get('boolean-fence-arm')).toEqual([]);
  });

  // Fails closed: `any`/`unknown` tell the checker nothing, so dropping
  // OPAQUE_TYPE_FLAGS from the probe must not let the ban lapse silently.
  test('keeps the polarity ban when the resolved type is opaque', () => {
    expect(
      (violationsByFixture.get('opaque-prefix') ?? [])
        .map((violation) => violation.propName)
        .toSorted(),
    ).toEqual(['showSearch', 'useNativeShare']);
  });

  // A type parameter is judged by its constraint, so a provably non-boolean
  // generic is the same false positive as `hideDelay?: number`; an
  // unconstrained one keeps the ban.
  test('resolves type parameters through their constraint', () => {
    expect(
      (violationsByFixture.get('generic-prefix') ?? [])
        .map((violation) => violation.propName)
        .toSorted(),
    ).toEqual(['showFlag', 'showLoose']);
  });

  // A constraint that demands nothing (`{}`, `unknown`) still admits `true`,
  // so the ban must stand — resolving the constraint must not become a way to
  // launder a prefixed boolean past the gate.
  test('keeps the ban when a constraint is wide enough to admit a boolean', () => {
    expect(
      (violationsByFixture.get('wide-constraint') ?? [])
        .map((violation) => violation.propName)
        .toSorted(),
    ).toEqual(['showAny', 'showEmpty', 'showUnion']);
  });

  test('passes constraints that rule a boolean out', () => {
    expect(violationsByFixture.get('narrow-constraint')).toEqual([]);
  });

  // These expose members, so a member-count heuristic would clear them even
  // though `true` is assignable to both.
  test('keeps the ban on object shapes a primitive boolean satisfies', () => {
    expect(
      (violationsByFixture.get('boolean-wrapper') ?? [])
        .map((violation) => violation.propName)
        .toSorted(),
    ).toEqual(['showValued', 'showWrapped']);
  });

  // `boolean` is not assignable to `NoInfer<Flag>` or to a branded
  // intersection, so the probe alone would clear both.
  test('keeps the ban through NoInfer and branded-intersection wrappers', () => {
    expect(
      (violationsByFixture.get('wrapped-boolean') ?? [])
        .map((violation) => violation.propName)
        .toSorted(),
    ).toEqual(['showBranded', 'showDeferredFlag']);
  });

  test('passes intersections whose boolean-admitting arm constrains nothing', () => {
    expect(violationsByFixture.get('branded-non-boolean')).toEqual([]);
  });

  // Nothing is assignable to an unresolved conditional or indexed access, so
  // the assignability probe alone would clear both.
  test('keeps the ban on deferred types that some instantiation makes boolean', () => {
    expect(
      (violationsByFixture.get('deferred-type') ?? [])
        .map((violation) => violation.propName)
        .toSorted(),
    ).toEqual(['showIndexed', 'showState']);
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
