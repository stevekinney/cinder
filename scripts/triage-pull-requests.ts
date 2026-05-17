#!/usr/bin/env bun
import { parseArgs } from 'node:util';
import { runTriage } from './triage-pull-requests/orchestrator';
import { realDeps } from './triage-pull-requests/dependencies';

if (import.meta.main) {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      execute: { type: 'boolean', default: false },
      unattended: { type: 'boolean', default: false },
      limit: { type: 'string' },
      'queue-limit': { type: 'string' },
      'max-attempts': { type: 'string' },
      'poll-attempts': { type: 'string' },
      'poll-interval': { type: 'string' },
      'agent-timeout': { type: 'string' },
      'include-new': { type: 'boolean', default: false },
      'retry-pending': { type: 'string', default: 'true' },
      'unsafe-no-head-match': { type: 'boolean', default: false },
    },
  });

  const code = await runTriage(
    {
      execute: values['execute'] ?? false,
      unattended: values['unattended'] ?? false,
      limit: values['limit'] !== undefined ? parseInt(values['limit'], 10) : undefined,
      queueLimit:
        values['queue-limit'] !== undefined ? parseInt(values['queue-limit'], 10) : undefined,
      maxAttempts: values['max-attempts'] !== undefined ? parseInt(values['max-attempts'], 10) : 5,
      pollAttempts:
        values['poll-attempts'] !== undefined ? parseInt(values['poll-attempts'], 10) : 5,
      pollIntervalMs:
        values['poll-interval'] !== undefined ? parseInt(values['poll-interval'], 10) : 60_000,
      agentTimeoutMs:
        values['agent-timeout'] !== undefined
          ? parseInt(values['agent-timeout'], 10) * 1_000
          : 1_800_000,
      includeNew: values['include-new'] ?? false,
      retryPending: values['retry-pending'] !== 'false',
      unsafeNoHeadMatch: values['unsafe-no-head-match'] ?? false,
    },
    realDeps,
  );

  process.exit(code);
}
