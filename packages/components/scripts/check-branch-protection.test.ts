import { describe, expect, it } from 'bun:test';

import {
  classifyProtectionResponse,
  EXIT_DRIFT,
  EXIT_OK,
  EXIT_SETUP_FAILURE,
  EXPECTATION_PATH,
  protectionDrift,
  type LiveProtection,
  type ProtectionExpectation,
} from './check-branch-protection.ts';
import { readJsonFile } from './lib/read-json-file.ts';

const expected: ProtectionExpectation = {
  branch: 'main',
  requiredStatusChecks: {
    strict: true,
    contexts: ['unit-tests', 'typecheck'],
  },
};

function live(overrides: LiveProtection['required_status_checks']): LiveProtection {
  return {
    required_status_checks: {
      strict: true,
      checks: [{ context: 'unit-tests' }, { context: 'typecheck' }],
      ...overrides,
    },
  };
}

describe('protectionDrift', () => {
  it('reports nothing when the live settings match', () => {
    expect(protectionDrift(expected, live({}))).toEqual([]);
  });

  // The drift that actually happened: docs/validation-topology.md asserted
  // `strict: true` was the steady state while the API returned false, because
  // a bulk drain lifted it and the manual restore never ran.
  it('reports a lifted strict flag', () => {
    const drift = protectionDrift(expected, live({ strict: false }));

    expect(drift).toHaveLength(1);
    expect(drift[0]).toContain('strict is false, expected true');
  });

  it('reports a required check that is no longer enforced', () => {
    const drift = protectionDrift(expected, live({ checks: [{ context: 'unit-tests' }] }));

    expect(drift).toEqual(['required status check "typecheck" is expected but not enforced']);
  });

  // Not drift to ignore: a check added to the settings but not the expectation
  // means the file has stopped describing reality, which is how it rots.
  it('reports a check enforced but absent from the expectation', () => {
    const drift = protectionDrift(
      expected,
      live({ checks: [{ context: 'unit-tests' }, { context: 'typecheck' }, { context: 'extra' }] }),
    );

    expect(drift).toHaveLength(1);
    expect(drift[0]).toContain('"extra" is enforced but not in the expectation');
  });

  it('reports protection being absent entirely rather than throwing', () => {
    expect(protectionDrift(expected, {})).toEqual([
      'required status checks are not configured at all on `main`',
    ]);
  });

  it('reports every drift at once so one run names the whole gap', () => {
    const drift = protectionDrift(expected, live({ strict: false, checks: [] }));

    expect(drift).toHaveLength(3);
  });

  // GitHub can report required checks through the legacy `contexts` (string[])
  // field instead of `checks`. Reading only `checks` here would treat a
  // contexts-only repository as enforcing nothing and file a daily false
  // drift issue.
  it('treats a contexts-only response as equivalent to checks', () => {
    const withContextsOnly: LiveProtection = {
      required_status_checks: {
        strict: true,
        contexts: ['unit-tests', 'typecheck'],
      },
    };

    expect(protectionDrift(expected, withContextsOnly)).toEqual([]);
  });

  it('unions checks and contexts when a repository reports both', () => {
    const mixed: LiveProtection = {
      required_status_checks: {
        strict: true,
        checks: [{ context: 'unit-tests' }],
        contexts: ['typecheck'],
      },
    };

    expect(protectionDrift(expected, mixed)).toEqual([]);
  });

  it('still reports a check missing from both checks and contexts', () => {
    const withContextsOnly: LiveProtection = {
      required_status_checks: {
        strict: true,
        contexts: ['unit-tests'],
      },
    };

    expect(protectionDrift(expected, withContextsOnly)).toEqual([
      'required status check "typecheck" is expected but not enforced',
    ]);
  });
});

describe('classifyProtectionResponse', () => {
  it('treats a 2xx status as ok', () => {
    expect(classifyProtectionResponse(200, { required_status_checks: {} })).toBe('ok');
  });

  it('treats a 404 with the exact "Branch not protected" message as protection genuinely absent', () => {
    expect(classifyProtectionResponse(404, { message: 'Branch not protected' })).toBe(
      'protection-absent',
    );
  });

  // GitHub can return 404 — not 403 — for a token without Administration: Read,
  // with the same "Not Found" body an unprivileged token gets from any resource
  // it can't see. Only the explicit "Branch not protected" message means
  // protection is really off; anything else at 404 must not be read as drift,
  // or an under-scoped token would file a false "protection is off" incident
  // every day.
  it('treats a 404 without that exact message as a setup failure, not drift', () => {
    expect(classifyProtectionResponse(404, { message: 'Not Found' })).toBe('setup-failure');
  });

  it('treats a 404 with no parseable message body as a setup failure, not drift', () => {
    expect(classifyProtectionResponse(404, undefined)).toBe('setup-failure');
    expect(classifyProtectionResponse(404, null)).toBe('setup-failure');
    expect(classifyProtectionResponse(404, { other: 'field' })).toBe('setup-failure');
  });

  it('treats a 403 as a setup failure', () => {
    expect(
      classifyProtectionResponse(403, { message: 'Resource not accessible by integration' }),
    ).toBe('setup-failure');
  });

  it('treats other non-2xx statuses as a setup failure', () => {
    expect(classifyProtectionResponse(500, { message: 'Internal Server Error' })).toBe(
      'setup-failure',
    );
  });
});

describe('exit codes', () => {
  // `main-red-watch.yaml` parses this numeric value to decide whether a
  // failed run means real drift (file the incident) or a setup problem
  // (annotate the run, don't file). They must stay distinct for that routing
  // to be possible at all.
  it('are distinct so the workflow can route drift from setup failures', () => {
    expect(new Set([EXIT_OK, EXIT_DRIFT, EXIT_SETUP_FAILURE]).size).toBe(3);
  });
});

describe('the checked-in expectation', () => {
  // Guards the file the whole check reads. A typo in a context name here would
  // otherwise make the guard assert something GitHub never reports.
  it('declares strict and the four required contexts', async () => {
    const onDisk = await readJsonFile<ProtectionExpectation>(EXPECTATION_PATH);

    expect(onDisk.branch).toBe('main');
    expect(onDisk.requiredStatusChecks.strict).toBe(true);
    expect(onDisk.requiredStatusChecks.contexts).toEqual([
      'unit-tests',
      'typecheck',
      'playwright',
      'Pre-1.0 changeset bump guard',
    ]);
  });
});
