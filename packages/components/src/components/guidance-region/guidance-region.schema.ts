import type { ComponentSchema } from '../../schema-types';

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    version: {
      type: 'string',
      description:
        "Version window claims are filtered against. When omitted—or passed as\n`''`, which is treated identically to omitted, not as an invalid\nversion—every claim is relevant and neither claim's `relevantFrom` nor\n`relevantUntil` is validated; this matters if an unset environment\nvalue can reach this prop as `''`. When supplied non-empty, it must be\nSemVer-shaped\n(`major.minor.patch`, each numeric with no leading zero, an optional\n`-prerelease` suffix whose own numeric identifiers also reject a\nleading zero, e.g. `'1.0.0-01'` fails to parse)—a shortened form like\n`'1.2'` fails to parse too. The parser accepts some forms strict\nSemVer doesn't: surrounding whitespace is trimmed before matching\n(`' 1.0.0 '` parses); an empty dot-separated identifier inside\n`-prerelease` or `+build` parses (`'1.0.0-alpha..1'`); and the\nleading-zero rejection applies only to `-prerelease`, never to\n`+build`, so `'1.0.0+01'` also parses. If this non-empty `version`\nitself fails to parse, every claim is filtered out—the whole registry\nsilently goes empty, not just the claims with malformed bounds. A\nclaim's `relevantFrom`/`relevantUntil` are parsed the same way, except\nthat `''` (as opposed to omitted) is treated as omitted there too, not\nas invalid input; if either is supplied non-empty and fails to parse,\nonly that claim is filtered out.",
    },
    storageKey: {
      type: 'string',
      description:
        "Key used to namespace dismissal state in the storage adapter. Defaults\nto `'cinder-guidance'`—regions sharing one storage adapter without an\nexplicit `storageKey` collide in that namespace.",
      default: 'cinder-guidance',
    },
  },
  additionalProperties: false,
  metadata: {
    unsupportedProps: [
      {
        name: 'anchorResolver',
        reason: 'function-or-snippet',
        description:
          "Resolves a claim anchor using consumer-owned DOM knowledge. Required\nfor any claim that isn't `kind: 'modal'`—which includes the default\ncase where `kind` is omitted: without `anchorResolver` (or when it\nresolves to a disconnected element), that claim can never be claimed\nand its guidance can never open. Omit this prop only when every\nregistered claim is `kind: 'modal'`—and even then, this `GuidanceRegion`\nmust be mounted beneath a `ModalRegion`: without that context, `claim()`\nreturns `false` for a modal claim too, so an all-modal registry with no\nsurrounding `ModalRegion` also never opens.",
      },
      {
        name: 'children',
        reason: 'function-or-snippet',
        description: 'Descendant application surface that consumes guidance through `useGuidance`.',
      },
      {
        name: 'claims',
        reason: 'unknown-shape',
        description:
          'Registered guidance claims available to descendants through\n`useGuidance`. Defaults to `[]`. (`GuidanceClaim` is not expressible in\nJSON Schema, so this default only appears here in prose.)',
      },
      {
        name: 'storage',
        reason: 'unknown-shape',
        description:
          'Adapter used to persist which claims a user has dismissed, so dismissal survives a reload.',
      },
    ],
  },
} satisfies ComponentSchema;

export default schema as ComponentSchema;
