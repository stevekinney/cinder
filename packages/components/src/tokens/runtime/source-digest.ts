/**
 * Canonical JSON and the digest that identifies a token source.
 *
 * The digest hashes a canonical form (object keys in code-unit order, no
 * insignificant whitespace), so equal sources hash equally wherever they were
 * authored or whatever order their keys arrived in. SHA-256 comes from Web
 * Crypto, which every browser, Bun, and Node provide; no Node module is
 * involved.
 */

/** `JSON.stringify` with object keys sorted, so equal values serialize identically. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (typeof value !== 'object' || value === null) return value;
  const sorted: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value).toSorted(([left], [right]) =>
    left < right ? -1 : left > right ? 1 : 0,
  )) {
    Object.defineProperty(sorted, key, {
      value: sortKeys(child),
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }
  return sorted;
}

/** The lowercase hexadecimal SHA-256 of a string's UTF-8 bytes. */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** What identifies a token source: its resolver and its documents keyed by relative path. */
export type DigestableSource = {
  resolver: unknown;
  documents: Readonly<Record<string, unknown>>;
};

/** `sha256:<hex>` over the canonical form of `{ resolver, documents }`. */
export async function computeSourceDigest(source: DigestableSource): Promise<string> {
  const text = canonicalJson({ resolver: source.resolver, documents: source.documents });
  return `sha256:${await sha256Hex(text)}`;
}
