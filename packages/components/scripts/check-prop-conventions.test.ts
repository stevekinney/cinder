import { describe, expect, test } from 'bun:test';

import { collectPropConventionViolations } from './check-prop-conventions';

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
