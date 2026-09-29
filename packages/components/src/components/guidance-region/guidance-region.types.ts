import type { Snippet } from 'svelte';
import type { GuidanceClaim, GuidanceStorage } from '../../_internal/guidance-context.ts';
export type GuidanceRegionProps = {
  /**
   * Registered guidance claims available to descendants through
   * `useGuidance`. Defaults to `[]`. (`GuidanceClaim` is not expressible in
   * JSON Schema, so this default only appears here in prose.)
   */
  claims?: GuidanceClaim[];
  /**
   * Version window claims are filtered against. When omitted—or passed as
   * `''`, which is treated identically to omitted, not as an invalid
   * version—every claim is relevant and neither claim's `relevantFrom` nor
   * `relevantUntil` is validated; this matters if an unset environment
   * value can reach this prop as `''`. When supplied non-empty, it must be
   * SemVer-shaped
   * (`major.minor.patch`, each numeric with no leading zero, an optional
   * `-prerelease` suffix whose own numeric identifiers also reject a
   * leading zero, e.g. `'1.0.0-01'` fails to parse)—a shortened form like
   * `'1.2'` fails to parse too. The parser accepts some forms strict
   * SemVer doesn't: surrounding whitespace is trimmed before matching
   * (`' 1.0.0 '` parses); an empty dot-separated identifier inside
   * `-prerelease` or `+build` parses (`'1.0.0-alpha..1'`); and the
   * leading-zero rejection applies only to `-prerelease`, never to
   * `+build`, so `'1.0.0+01'` also parses. If this non-empty `version`
   * itself fails to parse, every claim is filtered out—the whole registry
   * silently goes empty, not just the claims with malformed bounds. A
   * claim's `relevantFrom`/`relevantUntil` are parsed the same way, except
   * that `''` (as opposed to omitted) is treated as omitted there too, not
   * as invalid input; if either is supplied non-empty and fails to parse,
   * only that claim is filtered out.
   */
  version?: string;
  /** Adapter used to persist which claims a user has dismissed, so dismissal survives a reload. */
  storage?: GuidanceStorage;
  /**
   * Key used to namespace dismissal state in the storage adapter. Defaults
   * to `'cinder-guidance'`—regions sharing one storage adapter without an
   * explicit `storageKey` collide in that namespace.
   * @default 'cinder-guidance'
   */
  storageKey?: string;
  /**
   * Resolves a claim anchor using consumer-owned DOM knowledge. Required
   * for any claim that isn't `kind: 'modal'`—which includes the default
   * case where `kind` is omitted: without `anchorResolver` (or when it
   * resolves to a disconnected element), that claim can never be claimed
   * and its guidance can never open. Omit this prop only when every
   * registered claim is `kind: 'modal'`—and even then, this `GuidanceRegion`
   * must be mounted beneath a `ModalRegion`: without that context, `claim()`
   * returns `false` for a modal claim too, so an all-modal registry with no
   * surrounding `ModalRegion` also never opens.
   */
  anchorResolver?: (anchor: string) => HTMLElement | null;
  /** Descendant application surface that consumes guidance through `useGuidance`. */
  children?: Snippet;
};
