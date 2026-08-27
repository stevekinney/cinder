import { describe, expect, test } from 'bun:test';

import {
  type ComponentManifest,
  type RegistryView,
  crossCheckManifests,
} from './check-component-variable-registry.ts';

function registry(entries: Record<string, readonly string[]>): RegistryView {
  return {
    propertiesByComponent: new Map(
      Object.entries(entries).map(([component, properties]) => [component, new Set(properties)]),
    ),
  };
}

function manifest(component: string, variables: readonly string[]): ComponentManifest {
  return { component, variables };
}

describe('crossCheckManifests', () => {
  test('accepts a manifest whose every variable the corpus declares', () => {
    const result = crossCheckManifests(
      [manifest('button', ['--cinder-button-background', '--cinder-button-foreground'])],
      registry({ button: ['--cinder-button-background', '--cinder-button-foreground'] }),
    );
    expect(result.unbacked).toEqual([]);
    expect(result.checked).toEqual(['button']);
  });

  test('flags a manifest variable with no corpus token', () => {
    const result = crossCheckManifests(
      [manifest('button', ['--cinder-button-background', '--cinder-button-invented'])],
      registry({ button: ['--cinder-button-background'] }),
    );
    expect(result.unbacked).toEqual([
      { component: 'button', variable: '--cinder-button-invented' },
    ]);
  });

  // The scoping decision, pinned: a component the corpus does not model is
  // REPORTED, not silently passed. Passing it would read as coverage while
  // guarding nothing, which is worse than having no check.
  test('reports an unmodelled component rather than passing it silently', () => {
    const result = crossCheckManifests(
      [manifest('file-upload', ['--cinder-file-upload-progress-fill'])],
      registry({ button: ['--cinder-button-background'] }),
    );
    expect(result.unbacked).toEqual([]);
    expect(result.unmodelled).toEqual(['file-upload']);
    expect(result.checked).toEqual([]);
  });

  // An empty manifest is not an unmodelled surface — there is nothing to model.
  test('does not report an unmodelled component whose manifest is empty', () => {
    const result = crossCheckManifests([manifest('divider', [])], registry({}));
    expect(result.unmodelled).toEqual([]);
  });

  test('a component the corpus models with an empty manifest is checked, not reported', () => {
    const result = crossCheckManifests(
      [manifest('toggle', [])],
      registry({ toggle: ['--cinder-toggle-track'] }),
    );
    expect(result.checked).toEqual(['toggle']);
    expect(result.unmodelled).toEqual([]);
    expect(result.unbacked).toEqual([]);
  });

  test('reports every unbacked variable across components, not just the first', () => {
    const result = crossCheckManifests(
      [manifest('button', ['--cinder-button-a']), manifest('toggle', ['--cinder-toggle-b'])],
      registry({ button: [], toggle: [] }),
    );
    expect(result.unbacked).toHaveLength(2);
  });
});
