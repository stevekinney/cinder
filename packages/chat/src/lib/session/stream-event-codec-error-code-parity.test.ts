/**
 * COR-248: Chat's wire error vocabulary (`ChatAgentRunErrorCode`) is a
 * hand-maintained local mirror of Operative's `AgentRunErrorCode`
 * (`packages/operative/src/errors.ts`) — Chat does not depend on Operative
 * at runtime, so this type is declared structurally rather than imported.
 * A type-only `@lostgradient/operative` devDependency exists solely so this
 * file can assert the two stay in lockstep; nothing here reaches Chat's
 * shipped source (see `stream-event-codec-types.ts`'s own note on the
 * pattern this file protects).
 *
 * Two independent guarantees live here:
 *
 *  - A type-level bidirectional-equality assertion between
 *    `ChatAgentRunErrorCode` and Operative's `AgentRunErrorCode`. If either
 *    union gains or loses a member without the other following, this file
 *    fails to typecheck — caught by `bun run typecheck`, not merely by a
 *    runtime assertion that could be skipped or go unnoticed.
 *  - A runtime round-trip test proving every code in that (verified-equal)
 *    union survives `encodeChatStreamEvent` → `decodeChatStreamEvent`
 *    unchanged, on a `run.error` frame, for the whole vocabulary rather
 *    than only the codes a prior fix happened to add.
 */
import { describe, expect, test } from 'bun:test';
// Type-only: erased by `verbatimModuleSyntax`, so no Operative runtime code
// (or its Anthropic/OpenAI/Gemini provider dependencies) ever reaches
// Chat's bundle. `@lostgradient/operative` is a devDependency for exactly this
// import — see components/chat/package.json.
import type { AgentRunErrorCode as OperativeAgentRunErrorCode } from '@lostgradient/operative';
import type { ChatAgentRunErrorCode, ChatAgentRunErrorKind } from './stream-event-codec-types.ts';
import { decodeChatStreamEvent, encodeChatStreamEvent } from './stream-event-codec.ts';

/**
 * Standard exact-type-equality check (the `<G>() => ...` double-conditional
 * form), robust against the naive `A extends B ? B extends A : false` form's
 * distributive-conditional edge cases. See
 * `packages/skills/src/package-graph.test-d.ts` for this repository's other
 * use of a bidirectional structural assertion across a package boundary.
 */
type IfEquals<T, U, Y = true, N = false> =
  (<G>() => G extends T ? 1 : 2) extends <G>() => G extends U ? 1 : 2 ? Y : N;

/**
 * Fails to compile — not merely to run — when `_T` is not exactly `true`.
 * A real (no-op) function call, so it also executes cleanly under `bun
 * test`, which transpiles but does not type-check. The leading underscore
 * on `_T` opts it out of `noUnusedParameters` — the constraint itself is
 * the entire point, and the function is never called with an explicit
 * value argument to "read" it.
 */
function assertTypesEqual<_T extends true>(): void {}

// The parity assertion: if `ChatAgentRunErrorCode` and Operative's
// `AgentRunErrorCode` ever diverge in either direction, the type argument
// resolves to `false` and this call stops typechecking.
assertTypesEqual<IfEquals<ChatAgentRunErrorCode, OperativeAgentRunErrorCode>>();

/**
 * Every code in the (type-verified-equal) union, each paired with a
 * plausible `kind` matching the real Operative error class that raises it
 * (`packages/operative/src/errors.ts`). Typed as `Record<ChatAgentRunErrorCode,
 * ...>` rather than a bare array so this table itself cannot silently omit
 * a member: adding a code to the union without adding it here is a missing-
 * property compile error, and a stray key not in the union is an excess-
 * property compile error.
 */
const codesByKind: Record<ChatAgentRunErrorCode, ChatAgentRunErrorKind> = {
  INVALID_EXPORT: 'load',
  LOAD_FAILED: 'load',
  ABORTED: 'abort',
  BUDGET_EXCEEDED: 'policy',
  ELICITATION_DENIED: 'policy',
  INVALID_AGENT_HANDLE: 'contract',
  INVALID_OUTPUT: 'output',
  MAXIMUM_STEPS: 'policy',
  NON_JSON_OUTPUT: 'output',
  OUTPUT_SCHEMA_CONVERSION_FAILED: 'contract',
  SELECTION_REVALIDATION_FAILED: 'policy',
  SUBAGENT_RUN_FAILED: 'tool',
  TRIPWIRE: 'policy',
  UNKNOWN: 'generate',
};

describe('ChatAgentRunErrorCode / Operative AgentRunErrorCode parity (COR-248)', () => {
  for (const [code, kind] of Object.entries(codesByKind) as Array<
    [ChatAgentRunErrorCode, ChatAgentRunErrorKind]
  >) {
    test(`round-trips "${code}" through encode/decode unchanged`, () => {
      const event = {
        type: 'run.error' as const,
        error: {
          name: 'AgentRunError',
          message: `${code} example`,
          kind,
          code,
        },
        wireVersion: 1 as const,
        sequence: 1,
      };
      const decoded = decodeChatStreamEvent(encodeChatStreamEvent(event));
      expect(decoded.type).toBe('run.error');
      if (decoded.type === 'run.error') {
        // Exact equality, not just "still a valid code" — this is what
        // catches a silent widen to a different member (typically
        // `UNKNOWN`) for every code except `UNKNOWN` itself.
        expect(decoded.error.code).toBe(code);
        expect(decoded.error.kind).toBe(kind);
      }
    });
  }
});
