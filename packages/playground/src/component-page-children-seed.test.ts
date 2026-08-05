import { describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { allowsPlainTextChildren, NO_TEXT_CHILDREN } from './component-page-children-seed.ts';
import { CINDER_COMPONENT_SOURCE } from './component-sources.ts';
import {
  COMPOUND_COMPONENT_FAMILIES,
  COMPOUND_COMPONENT_PARENTS,
} from './shell-app/compound-families.ts';
import type { ComponentManifest } from './types.ts';

function manifest(kebabName: string, isCompound = false): ComponentManifest {
  return {
    name: 'X',
    kebabName,
    file: `${kebabName}.svelte`,
    importPath: kebabName,
    props: [],
    ...(isCompound ? { isCompound: true } : {}),
  };
}

describe('allowsPlainTextChildren', () => {
  test('allows the ordinary case', () => {
    // Badge, Button, Chip and friends render plain text children — that is the
    // whole reason the seed exists, and the common path must stay allowed.
    expect(allowsPlainTextChildren(manifest('badge'))).toBe(true);
    expect(allowsPlainTextChildren(manifest('card'))).toBe(true);
    expect(allowsPlainTextChildren(manifest('callout'))).toBe(true);
  });

  test('rejects compound roots and every family member', () => {
    expect(allowsPlainTextChildren(manifest('accordion', true))).toBe(false);
    // A leaf: `<td>` with no `<tr>` ancestor.
    expect(allowsPlainTextChildren(manifest('table-cell'))).toBe(false);
    // A family ROOT whose index.ts re-exports rather than `Object.assign`-ing,
    // so `isCompound` is false and only the family table catches it.
    expect(allowsPlainTextChildren(manifest('segmented-control'))).toBe(false);
  });

  test('rejects the layout, overlay, and behavior-wrapper cases', () => {
    expect(allowsPlainTextChildren(manifest('masonry'))).toBe(false);
    expect(allowsPlainTextChildren(manifest('modal'))).toBe(false);
    expect(allowsPlainTextChildren(manifest('focus-trap'))).toBe(false);
    expect(allowsPlainTextChildren(manifest('checkbox-group'))).toBe(false);
  });
});

describe('NO_TEXT_CHILDREN drift guards', () => {
  test('every entry names a real component', () => {
    for (const slug of NO_TEXT_CHILDREN) {
      const path = join(CINDER_COMPONENT_SOURCE.componentsRoot, slug, `${slug}.svelte`);
      expect({ slug, exists: existsSync(path) }).toEqual({ slug, exists: true });
    }
  });

  test('no entry is redundant with the compound-family rules', () => {
    // The family rules are derived and maintained elsewhere; a slug listed here
    // as well would be a second, silently-drifting source of truth.
    for (const slug of NO_TEXT_CHILDREN) {
      expect({ slug, inFamilyTable: slug in COMPOUND_COMPONENT_PARENTS }).toEqual({
        slug,
        inFamilyTable: false,
      });
      expect({ slug, isFamilyRoot: slug in COMPOUND_COMPONENT_FAMILIES }).toEqual({
        slug,
        isFamilyRoot: false,
      });
    }
  });
});
