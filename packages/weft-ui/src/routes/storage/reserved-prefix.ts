/**
 * Reserved-key-prefix guard (plan §9.6, T7.1): "Reserved-prefix guards:
 * `WEFT_RESERVED_KEY_PREFIXES` warning banner + inline input warning." The
 * prefix list is imported directly from `@lostgradient/weft`
 * (publicly exported, documented as a stable keyspace contract) rather than
 * pinned as a local copy — no drift risk to guard against with a test here.
 */
import { WEFT_RESERVED_KEY_PREFIXES } from '@lostgradient/weft';

export { WEFT_RESERVED_KEY_PREFIXES };

/** Returns the matched reserved prefix, or `undefined` when `key` doesn't start with one. */
export function matchedReservedPrefix(key: string): string | undefined {
  return WEFT_RESERVED_KEY_PREFIXES.find((prefix) => key.startsWith(prefix));
}

/** `true` when `key` falls under a Weft-owned reserved prefix. */
export function isReservedKey(key: string): boolean {
  return matchedReservedPrefix(key) !== undefined;
}
