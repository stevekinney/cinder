import { describe, expect, test } from 'bun:test';

import { codegenPreviewSource, type RegistryLike } from './codegen-preview-source.ts';
import type { WorkflowRevisionManifestSource } from './registry-view.ts';

/** Build a manifest at revision `<name>-rev` and mark it active by default. */
function manifest(
  name: string,
  contract: Partial<WorkflowRevisionManifestSource['contract']> = {},
): WorkflowRevisionManifestSource {
  return {
    manifestVersion: 1,
    name,
    workflowVersion: '1.0.0',
    revision: `${name}-rev`,
    contractHash: `${name}-hash`,
    contract: { name, workflowVersion: '1.0.0', ...contract },
  };
}

function activeRevisionsFor(
  workflows: readonly WorkflowRevisionManifestSource[],
): Record<string, string> {
  return Object.fromEntries(workflows.map((entry) => [entry.name, entry.revision]));
}

describe('codegenPreviewSource', () => {
  test('undefined when nothing is registered', () => {
    expect(
      codegenPreviewSource({
        registryVersion: 2,
        workflows: [],
        activeRevisions: {},
        activities: {},
      }),
    ).toBeUndefined();
  });

  test('undefined when no active workflow has an input schema', () => {
    const workflows = [manifest('long-sleeper'), manifest('review-gate')];
    const registry: RegistryLike = {
      registryVersion: 2,
      workflows,
      activeRevisions: activeRevisionsFor(workflows),
      activities: {},
    };
    expect(codegenPreviewSource(registry)).toBeUndefined();
  });

  test('picks the codepoint-first active workflow with a schema and renders its preview', () => {
    const workflows = [
      manifest('zebra-workflow', {
        inputSchema: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      }),
      manifest('order-processing', {
        inputSchema: {
          type: 'object',
          required: ['orderId'],
          properties: { orderId: { type: 'string' } },
        },
      }),
    ];
    const registry: RegistryLike = {
      registryVersion: 2,
      workflows,
      activeRevisions: activeRevisionsFor(workflows),
      activities: {},
    };

    const preview = codegenPreviewSource(registry);
    expect(preview).toContain('export interface OrderProcessingInput');
    expect(preview).not.toContain('Zebra');
  });

  test('ignores a manifest whose revision is not the active one', () => {
    const active = manifest('order-processing', {
      inputSchema: {
        type: 'object',
        required: ['orderId'],
        properties: { orderId: { type: 'string' } },
      },
    });
    const inactive: WorkflowRevisionManifestSource = {
      ...manifest('audit-sweep', {
        inputSchema: { type: 'object', properties: { note: { type: 'string' } } },
      }),
      revision: 'audit-sweep-old-rev',
    };
    const registry: RegistryLike = {
      registryVersion: 2,
      workflows: [active, inactive],
      // `audit-sweep`'s active pointer names a different revision than the
      // one manifest present, so it must be excluded from the preview pool.
      activeRevisions: { 'order-processing': active.revision, 'audit-sweep': 'some-other-rev' },
      activities: {},
    };

    const preview = codegenPreviewSource(registry);
    expect(preview).toContain('export interface OrderProcessingInput');
    expect(preview).not.toContain('AuditSweep');
  });
});
