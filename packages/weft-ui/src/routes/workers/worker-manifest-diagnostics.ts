/** Runtime-validated view models for the canonical worker-manifest diagnostics operations. */

export type WorkerActivityContractDiagnostics = Readonly<{
  contractHash: string;
  implementationRevision: string;
}>;

export type WorkerWorkflowContractDiagnostics = Readonly<{
  workflowVersion: string;
  workflowRevision: string;
  contractHash: string;
  activities: Readonly<Record<string, WorkerActivityContractDiagnostics>>;
}>;

export type WorkerManifestDiagnostics = Readonly<{
  instance: Readonly<{
    workerId: string;
    queue: string;
    health: 'active' | 'draining' | 'drained';
    connectedAt: number;
    startedAt: number;
    lastHeartbeatAt: number;
    heartbeatAgeMs: number;
  }>;
  deploymentVersion: Readonly<{
    deploymentName: string;
    buildId: string;
    artifactDigest: string;
    runtimeName: string;
    runtimeVersion: string;
    sdkVersion: string;
    manifestVersion: number;
    protocolVersion: number;
    manifestDigest: string;
    workflows: Readonly<Record<string, WorkerWorkflowContractDiagnostics>>;
  }>;
}>;

export type WorkerRegistrationRejection = Readonly<{
  code:
    | 'invalid_registration'
    | 'unsupported_protocol_version'
    | 'deployment_conflict'
    | 'registration_rejected';
  rejectedAt: number;
  workerId?: string;
  queue?: string;
  deploymentName?: string;
  buildId?: string;
}>;

export class MalformedWorkerDiagnosticsError extends Error {
  constructor(path: string) {
    super(`The server returned malformed worker diagnostics at ${path}.`);
    this.name = 'MalformedWorkerDiagnosticsError';
  }
}

function recordAt(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new MalformedWorkerDiagnosticsError(path);
  }
  const record: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) record[key] = entry;
  return record;
}

function stringAt(record: Record<string, unknown>, key: string, path: string): string {
  const value = record[key];
  if (typeof value !== 'string') throw new MalformedWorkerDiagnosticsError(`${path}.${key}`);
  return value;
}

function numberAt(record: Record<string, unknown>, key: string, path: string): number {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new MalformedWorkerDiagnosticsError(`${path}.${key}`);
  }
  return value;
}

function parseActivityContracts(
  value: unknown,
  path: string,
): Readonly<Record<string, WorkerActivityContractDiagnostics>> {
  const source = recordAt(value, path);
  return Object.fromEntries(
    Object.entries(source).map(([name, candidate]) => {
      const activity = recordAt(candidate, `${path}.${name}`);
      return [
        name,
        {
          contractHash: stringAt(activity, 'contractHash', `${path}.${name}`),
          implementationRevision: stringAt(activity, 'implementationRevision', `${path}.${name}`),
        },
      ];
    }),
  );
}

function parseWorkflowContracts(
  value: unknown,
  path: string,
): Readonly<Record<string, WorkerWorkflowContractDiagnostics>> {
  const source = recordAt(value, path);
  return Object.fromEntries(
    Object.entries(source).map(([name, candidate]) => {
      const workflow = recordAt(candidate, `${path}.${name}`);
      return [
        name,
        {
          workflowVersion: stringAt(workflow, 'workflowVersion', `${path}.${name}`),
          workflowRevision: stringAt(workflow, 'workflowRevision', `${path}.${name}`),
          contractHash: stringAt(workflow, 'contractHash', `${path}.${name}`),
          activities: parseActivityContracts(workflow['activities'], `${path}.${name}.activities`),
        },
      ];
    }),
  );
}

/** Validates the generated client's intentionally-unknown diagnostics payload at the Console boundary. */
export function parseWorkerDiagnosticsResponse(value: unknown): WorkerManifestDiagnostics | null {
  const output = recordAt(value, 'response');
  if (output['worker'] === null) return null;

  const worker = recordAt(output['worker'], 'response.worker');
  const instance = recordAt(worker['instance'], 'response.worker.instance');
  const deployment = recordAt(worker['deploymentVersion'], 'response.worker.deploymentVersion');
  const health = stringAt(instance, 'health', 'response.worker.instance');
  if (health !== 'active' && health !== 'draining' && health !== 'drained') {
    throw new MalformedWorkerDiagnosticsError('response.worker.instance.health');
  }

  return {
    instance: {
      workerId: stringAt(instance, 'workerId', 'response.worker.instance'),
      queue: stringAt(instance, 'queue', 'response.worker.instance'),
      health,
      connectedAt: numberAt(instance, 'connectedAt', 'response.worker.instance'),
      startedAt: numberAt(instance, 'startedAt', 'response.worker.instance'),
      lastHeartbeatAt: numberAt(instance, 'lastHeartbeatAt', 'response.worker.instance'),
      heartbeatAgeMs: numberAt(instance, 'heartbeatAgeMs', 'response.worker.instance'),
    },
    deploymentVersion: {
      deploymentName: stringAt(deployment, 'deploymentName', 'response.worker.deploymentVersion'),
      buildId: stringAt(deployment, 'buildId', 'response.worker.deploymentVersion'),
      artifactDigest: stringAt(deployment, 'artifactDigest', 'response.worker.deploymentVersion'),
      runtimeName: stringAt(deployment, 'runtimeName', 'response.worker.deploymentVersion'),
      runtimeVersion: stringAt(deployment, 'runtimeVersion', 'response.worker.deploymentVersion'),
      sdkVersion: stringAt(deployment, 'sdkVersion', 'response.worker.deploymentVersion'),
      manifestVersion: numberAt(deployment, 'manifestVersion', 'response.worker.deploymentVersion'),
      protocolVersion: numberAt(deployment, 'protocolVersion', 'response.worker.deploymentVersion'),
      manifestDigest: stringAt(deployment, 'manifestDigest', 'response.worker.deploymentVersion'),
      workflows: parseWorkflowContracts(
        deployment['workflows'],
        'response.worker.deploymentVersion.workflows',
      ),
    },
  };
}

export type DeploymentManifestComparison = Readonly<{
  deploymentName: string;
  buildId: string;
  workers: readonly string[];
  artifactDigests: readonly string[];
  manifestDigests: readonly string[];
  disagreements: readonly ('artifact' | 'manifest' | 'workflow-contract')[];
}>;

function workflowContractIdentity(diagnostics: WorkerManifestDiagnostics): string {
  return JSON.stringify(
    Object.entries(diagnostics.deploymentVersion.workflows)
      .toSorted(([left], [right]) => left.localeCompare(right))
      .map(([name, workflow]) => [
        name,
        workflow.workflowVersion,
        workflow.workflowRevision,
        workflow.contractHash,
        Object.entries(workflow.activities)
          .toSorted(([left], [right]) => left.localeCompare(right))
          .map(([activityName, activity]) => [
            activityName,
            activity.contractHash,
            activity.implementationRevision,
          ]),
      ]),
  );
}

/** Compares workers claiming the same deployment name and build identifier. */
export function compareDeploymentManifests(
  diagnostics: readonly WorkerManifestDiagnostics[],
): readonly DeploymentManifestComparison[] {
  const groups = new Map<string, WorkerManifestDiagnostics[]>();
  for (const entry of diagnostics) {
    const key = `${entry.deploymentVersion.deploymentName}\u0000${entry.deploymentVersion.buildId}`;
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }

  return [...groups.values()]
    .filter((entries) => entries.length > 1)
    .map((entries) => {
      const first = entries[0]!;
      const artifactDigests = [
        ...new Set(entries.map((entry) => entry.deploymentVersion.artifactDigest)),
      ];
      const manifestDigests = [
        ...new Set(entries.map((entry) => entry.deploymentVersion.manifestDigest)),
      ];
      const workflowContracts = new Set(entries.map(workflowContractIdentity));
      const disagreements: DeploymentManifestComparison['disagreements'][number][] = [];
      if (artifactDigests.length > 1) disagreements.push('artifact');
      if (manifestDigests.length > 1) disagreements.push('manifest');
      if (workflowContracts.size > 1) disagreements.push('workflow-contract');
      return {
        deploymentName: first.deploymentVersion.deploymentName,
        buildId: first.deploymentVersion.buildId,
        workers: entries.map((entry) => entry.instance.workerId).toSorted(),
        artifactDigests: artifactDigests.toSorted(),
        manifestDigests: manifestDigests.toSorted(),
        disagreements,
      };
    })
    .toSorted((left, right) =>
      `${left.deploymentName}\u0000${left.buildId}`.localeCompare(
        `${right.deploymentName}\u0000${right.buildId}`,
      ),
    );
}

export const REGISTRATION_REJECTION_LABELS: Readonly<
  Record<WorkerRegistrationRejection['code'], string>
> = {
  invalid_registration: 'Invalid registration',
  unsupported_protocol_version: 'Unsupported protocol version',
  deployment_conflict: 'Deployment conflict',
  registration_rejected: 'Admission policy rejected',
};

const REGISTRATION_REJECTION_CODES: ReadonlySet<string> = new Set(
  Object.keys(REGISTRATION_REJECTION_LABELS),
);

function isRegistrationRejectionCode(value: string): value is WorkerRegistrationRejection['code'] {
  return REGISTRATION_REJECTION_CODES.has(value);
}

function optionalStringAt(
  record: Record<string, unknown>,
  key: string,
  path: string,
): string | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new MalformedWorkerDiagnosticsError(`${path}.${key}`);
  return value;
}

/** Validates the rejection operation despite its generated compile-time shape. */
export function parseWorkerRegistrationRejections(
  value: unknown,
): readonly WorkerRegistrationRejection[] {
  const output = recordAt(value, 'response');
  numberAt(output, 'limit', 'response');
  if (!Array.isArray(output['items'])) {
    throw new MalformedWorkerDiagnosticsError('response.items');
  }
  return output['items'].map((candidate, index) => {
    const path = `response.items.${String(index)}`;
    const entry = recordAt(candidate, path);
    const code = stringAt(entry, 'code', path);
    if (!isRegistrationRejectionCode(code)) {
      throw new MalformedWorkerDiagnosticsError(`${path}.code`);
    }
    const workerId = optionalStringAt(entry, 'workerId', path);
    const queue = optionalStringAt(entry, 'queue', path);
    const deploymentName = optionalStringAt(entry, 'deploymentName', path);
    const buildId = optionalStringAt(entry, 'buildId', path);
    return {
      code,
      rejectedAt: numberAt(entry, 'rejectedAt', path),
      ...(workerId !== undefined ? { workerId } : {}),
      ...(queue !== undefined ? { queue } : {}),
      ...(deploymentName !== undefined ? { deploymentName } : {}),
      ...(buildId !== undefined ? { buildId } : {}),
    };
  });
}
