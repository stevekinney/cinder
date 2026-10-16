/**
 * Palette membership for the authoring catalogue. A color token joins a palette family only by
 * declaring `palette: { family, role, anchor? }` in its `com.lostgradient.cinder` extension;
 * nothing is inferred from a token-name prefix, so palette generation cannot reach an unrelated
 * group. The metadata is value-neutral: it never changes a token's value or its CSS.
 *
 * Each family must have exactly one anchor in every concrete context, roles are unique within a
 * family, and a token declares the same membership in every context.
 */

import {
  PALETTE_FAMILIES,
  UNKNOWN,
  type AuthoringRecord,
  type PaletteFamily,
  type PaletteMembership,
} from './authoring-types.ts';

type Extensions = Record<string, unknown>;

const PALETTE_KEYS = new Set(['family', 'role', 'anchor']);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isFamily = (value: unknown): value is PaletteFamily =>
  PALETTE_FAMILIES.some((family) => family === value);

/** Parses one declared `palette` extension, or throws a path-addressed error. */
function parseMembership(path: string, raw: unknown): PaletteMembership {
  if (!isRecord(raw)) throw new Error(`Token "${path}" declares a palette that is not an object.`);
  for (const key of Object.keys(raw)) {
    if (!PALETTE_KEYS.has(key))
      throw new Error(`Token "${path}" palette declares unknown "${key}".`);
  }
  const { family, role, anchor } = raw;
  if (!isFamily(family)) {
    const shown = typeof family === 'string' ? family : JSON.stringify(family);
    throw new Error(`Token "${path}" declares unknown palette family "${shown}".`);
  }
  if (typeof role !== 'string' || role.trim() === '') {
    throw new Error(`Token "${path}" palette needs a non-empty role.`);
  }
  if (anchor !== undefined && typeof anchor !== 'boolean') {
    throw new Error(`Token "${path}" palette anchor must be a boolean.`);
  }
  return { family, role, anchor: anchor === true };
}

/** The palette a color token declares in each context, or `undefined` when it declares none. */
export function paletteOf(
  path: string,
  extensionsByContext: readonly Extensions[],
): PaletteMembership | undefined {
  const declared = extensionsByContext.map((extensions) =>
    extensions['palette'] === undefined ? undefined : parseMembership(path, extensions['palette']),
  );
  const first = declared[0];
  if (declared.some((membership) => JSON.stringify(membership) !== JSON.stringify(first))) {
    throw new Error(`Token "${path}" declares a different palette in different contexts.`);
  }
  return first;
}

export const NO_PALETTE = { family: UNKNOWN, role: UNKNOWN, anchor: UNKNOWN } as const;

/**
 * Checks the declared memberships as a whole: every family has exactly one anchor and no role
 * repeats inside a family. Every context declares the same membership, so the check holds for
 * each concrete context.
 */
export function validatePalettes(records: readonly AuthoringRecord[]): void {
  type Member = PaletteMembership & { path: string };
  const families = new Map<PaletteFamily, Member[]>();
  for (const record of records) {
    const palette = record.palette;
    if (palette === undefined || palette.family === UNKNOWN) continue;
    const membership = palette;
    const members = families.get(membership.family) ?? [];
    members.push({ ...membership, path: record.path });
    families.set(membership.family, members);
  }
  for (const [family, members] of families) {
    const anchors = members.filter((member) => member.anchor);
    if (anchors.length === 0) {
      throw new Error(`Palette family "${family}" has no anchor.`);
    }
    if (anchors.length > 1) {
      const paths = anchors.map((member) => member.path).join(', ');
      throw new Error(`Palette family "${family}" has more than one anchor: ${paths}.`);
    }
    const roles = new Set<string>();
    for (const member of members) {
      if (roles.has(member.role)) {
        throw new Error(`Palette family "${family}" repeats the role "${member.role}".`);
      }
      roles.add(member.role);
    }
  }
}
