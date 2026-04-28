/**
 * Unit tests for `scripts/playground/wrapper-generator.ts`.
 *
 * These tests use hand-crafted minimal manifests — they do NOT call `analyzeComponent`
 * from the static analyzer. The goal is to validate the string-generation logic only.
 */

import { describe, expect, it } from 'bun:test';

import type { ComponentManifest, PropManifest } from './wrapper-generator.ts';
import { generateWrapper } from './wrapper-generator.ts';

/** Minimal Button manifest for testing — does not reflect all real Button props. */
const buttonManifest: ComponentManifest = {
  name: 'button',
  importPath: '../../../../src/components/button.svelte',
  props: [
    {
      name: 'variant',
      control: { kind: 'select', options: ['primary', 'secondary', 'danger', 'ghost'] },
      bindable: false,
      defaultValue: 'secondary',
      optional: true,
    },
    {
      name: 'label',
      control: { kind: 'text' },
      bindable: false,
      optional: true,
    },
    {
      name: 'loading',
      control: { kind: 'boolean' },
      bindable: false,
      defaultValue: false,
      optional: true,
    },
    {
      name: 'children',
      control: { kind: 'snippet' },
      bindable: false,
      optional: true,
    },
    {
      name: 'class',
      control: { kind: 'text' },
      bindable: false,
      optional: true,
    },
  ],
};

describe('generateWrapper', () => {
  it('contains an import statement for the Button component', () => {
    const output = generateWrapper(buttonManifest);
    expect(output).toContain('import');
    expect(output).toContain('Button');
  });

  it('references __CINDER_CONTROLS__', () => {
    const output = generateWrapper(buttonManifest);
    expect(output).toContain('__CINDER_CONTROLS__');
  });

  it('imports from the importPath in the manifest', () => {
    const output = generateWrapper(buttonManifest);
    expect(output).toContain('../../../../src/components/button.svelte');
  });

  it('excludes snippet props from the allowed keys', () => {
    const output = generateWrapper(buttonManifest);
    // 'children' is a snippet and must not appear in the allowedKeys set
    const allowedKeysMatch = output.match(/allowedKeys = new Set\((\[.*?\])\)/s);
    expect(allowedKeysMatch).not.toBeNull();
    const allowedKeysJson = allowedKeysMatch![1]!;
    const allowedKeys: string[] = JSON.parse(allowedKeysJson);
    expect(allowedKeys).not.toContain('children');
  });

  it('excludes the class prop from the allowed keys', () => {
    const output = generateWrapper(buttonManifest);
    const allowedKeysMatch = output.match(/allowedKeys = new Set\((\[.*?\])\)/s);
    expect(allowedKeysMatch).not.toBeNull();
    const allowedKeysJson = allowedKeysMatch![1]!;
    const allowedKeys: string[] = JSON.parse(allowedKeysJson);
    expect(allowedKeys).not.toContain('class');
  });

  it('includes non-snippet, non-class props in the allowed keys', () => {
    const output = generateWrapper(buttonManifest);
    const allowedKeysMatch = output.match(/allowedKeys = new Set\((\[.*?\])\)/s);
    expect(allowedKeysMatch).not.toBeNull();
    const allowedKeysJson = allowedKeysMatch![1]!;
    const allowedKeys: string[] = JSON.parse(allowedKeysJson);
    expect(allowedKeys).toContain('variant');
    expect(allowedKeys).toContain('label');
    expect(allowedKeys).toContain('loading');
  });

  it('renders the component with spread controlProps', () => {
    const output = generateWrapper(buttonManifest);
    expect(output).toContain('<Button');
    expect(output).toContain('{...controlProps}');
  });

  it('uses $state for the controlProps object', () => {
    const output = generateWrapper(buttonManifest);
    expect(output).toContain('$state');
  });

  it('uses Svelte 5 script syntax (lang="ts")', () => {
    const output = generateWrapper(buttonManifest);
    expect(output).toContain('<script lang="ts">');
    expect(output).not.toContain('context="module"');
  });

  it('handles a component with no controllable props gracefully', () => {
    const emptyManifest: ComponentManifest = {
      name: 'spinner',
      importPath: '../../../../src/components/spinner.svelte',
      props: [
        {
          name: 'children',
          control: { kind: 'snippet' },
          bindable: false,
          optional: true,
        },
        {
          name: 'class',
          control: { kind: 'text' },
          bindable: false,
          optional: true,
        },
      ],
    };

    const output = generateWrapper(emptyManifest);
    expect(output).toContain('Spinner');
    expect(output).toContain('__CINDER_CONTROLS__');

    const allowedKeysMatch = output.match(/allowedKeys = new Set\((\[.*?\])\)/s);
    expect(allowedKeysMatch).not.toBeNull();
    const allowedKeys: string[] = JSON.parse(allowedKeysMatch![1]!);
    expect(allowedKeys).toHaveLength(0);
  });

  it('converts a multi-word kebab name to PascalCase for the identifier', () => {
    const manifest: ComponentManifest = {
      name: 'data-list',
      importPath: '../../../../src/components/data-list.svelte',
      props: [],
    };
    const output = generateWrapper(manifest);
    expect(output).toContain('import DataList from');
    expect(output).toContain('<DataList');
  });

  it('satisfies the PropManifest type with a bindable prop', () => {
    const prop: PropManifest = {
      name: 'value',
      control: { kind: 'text' },
      bindable: true,
      optional: false,
    };
    // No assertion needed — this is a compile-time type check exercised by the test runner.
    expect(prop.bindable).toBe(true);
  });
});
