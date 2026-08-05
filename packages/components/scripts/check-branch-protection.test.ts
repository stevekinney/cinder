import { describe, expect, it } from 'bun:test';

import {
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
