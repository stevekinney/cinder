import { describe, expect, test } from 'bun:test';

import type { AgentRun, DiagnosticAgentRun, SessionHandle } from '@lostgradient/operative';

/**
 * What the published Operative types actually say about a recovered run.
 *
 * CIN-445 asked for the step-level-progress claim to be "enforced by the
 * published types", on the premise that a recovered run is a
 * `DiagnosticAgentRun` which "deliberately omits the `output()` and `unwrap()`
 * accessors". Checking that against `0.11.0` turned up three things:
 *
 *   1. `SessionHandle.recover()` is declared `Promise<AgentRun | null>`. The
 *      recovered handle is wrapped with `createAgentRun`, not
 *      `createDiagnosticAgentRun` — upstream's own comment beside the call says
 *      "wrap it as an `AgentRun` so the caller can observe the resumed run
 *      normally". The narrowing the criterion relies on is not on this path.
 *   2. `output()` is absent from `AgentRun` at the default `H = false` anyway
 *      (`OutputMethod<O, H>` resolves to `Record<never, never>`), so half the
 *      premise describes a distinction that does not exist here.
 *   3. `DiagnosticAgentRun` does omit both accessors, and carries a third
 *      difference the criterion does not mention and which has teeth: its
 *      `closed()` downgrades a wrapped `'completed'` to `{ status:
 *      'unresolved', reason: 'unknown-effect' }`, because durability is
 *      undeterminable from a recovered wrapper. The session path passes that
 *      status through unchanged.
 *
 * TYPE-LEVEL, in a file `bun run check` compiles, because the sentence these
 * replace was wrong for two minor versions before anyone checked it.
 *
 * DIRECTIONAL, and that is the second attempt. The first wrote a mutual
 * `Exact<Left, Right>` assignability helper, which passed with the claim
 * deliberately inverted: `AgentRun<never, false>` and `DiagnosticAgentRun` are
 * mutually assignable as far as TypeScript is concerned, so an equality helper
 * over them reports `true` either way and pins nothing. Each test below either
 * reads a member that only one of the two shapes has, or carries a
 * `@ts-expect-error` that fails the build the moment the error it expects stops
 * happening. Both forms were proved by inverting them and watching `bun run
 * check` fail.
 */

declare const handle: SessionHandle;
declare const diagnostic: DiagnosticAgentRun;
declare const live: AgentRun;

describe('the published shape of a recovered run', () => {
	test('recover() hands back a handle that still has unwrap(), so it is not a DiagnosticAgentRun', async () => {
		// `unwrap()` is the accessor the two shapes genuinely differ on. Reading
		// it off `recover()`'s result is what pins the declared return type: were
		// upstream to narrow `recover()` to `DiagnosticAgentRun | null`, this line
		// would stop compiling and the recovery endpoint's comment about
		// step-level progress would need to cite the narrowing rather than the
		// checkpoint.
		//
		// Never CALLED — `handle` is a declared type, with no implementation
		// behind it. The assertion is that the expression type-checks.
		type Recovered = NonNullable<Awaited<ReturnType<SessionHandle['recover']>>>;
		type Unwrapped = ReturnType<Recovered['unwrap']>;
		const unwrapReturnsText: Unwrapped extends Promise<string> ? true : false = true;
		expect(unwrapReturnsText).toBe(true);
		expect(typeof handle).toBe('undefined');
	});

	test('a DiagnosticAgentRun offers no unwrap()', () => {
		// @ts-expect-error `unwrap` is deliberately deleted from a diagnostic run:
		// its originating schema may no longer be available to validate against.
		const absent = diagnostic.unwrap;
		expect(absent).toBeUndefined();
	});

	test('a DiagnosticAgentRun offers no output()', () => {
		// @ts-expect-error same deletion, same reason.
		const absent = diagnostic.output;
		expect(absent).toBeUndefined();
	});

	test('output() is absent from an untyped AgentRun too, so its absence is not the distinction', () => {
		// The half of CIN-445's premise that turned out vacuous. `AgentRun`'s
		// defaults are `<O = never, H extends boolean = false>` and `output()`
		// exists only at `H = true`, so a consumer holding `recover()`'s result
		// could not have called it on either shape.
		// @ts-expect-error not present at the default `H = false`.
		const absent = live.output;
		expect(absent).toBeUndefined();
	});

	test('both shapes answer result(), which is what a recovery surface would read', () => {
		// Neither handle is useless after recovery. The diagnostic one widens its
		// output to `unknown`, which is the honest consequence of not being able
		// to validate against the originating schema.
		const liveResult: () => unknown = live.result;
		const diagnosticResult: () => unknown = diagnostic.result;
		expect([typeof liveResult, typeof diagnosticResult]).toEqual(['undefined', 'undefined']);
	});
});
