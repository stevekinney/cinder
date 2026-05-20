/**
 * Serialize `{name}.constraints.ts` sidecars to `{name}.constraints.json`.
 *
 * For every component directory that contains a `{name}.constraints.ts` file,
 * this script:
 *
 *  1. Dynamically imports the default export (a `ConstraintsDocument`).
 *  2. Validates the document shape (id is kebab-case, rule ids are unique within
 *     the document, severity values are in the closed set).
 *  3. Writes deterministically ordered JSON next to the source file.
 *
 * Usage:
 *   bun run scripts/generate-component-constraints.ts           # write
 *   bun run scripts/generate-component-constraints.ts --check  # drift check
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import type { ConstraintsDocument, ConstraintSeverity } from '../src/_internal/constraints.ts';
import { discoverComponentDirectories } from './generate-component-artifacts.ts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SCHEMA_REF = '../../schemas/constraints.schema.json';
const VALID_SEVERITIES = new Set<ConstraintSeverity>(['error', 'warning', 'info']);
const KEBAB_CASE_PATTERN = /^[a-z][a-z0-9-]*$/;

// ---------------------------------------------------------------------------
// Type guard
// ---------------------------------------------------------------------------

function isConstraintsDocument(value: unknown): value is ConstraintsDocument {
  return (
    value !== null &&
    typeof value === 'object' &&
    'component' in value &&
    typeof (value as Record<string, unknown>)['component'] === 'string' &&
    'rules' in value &&
    Array.isArray((value as Record<string, unknown>)['rules'])
  );
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

type ValidationError = string;

function validateDocument(document: ConstraintsDocument, expectedId: string): ValidationError[] {
  const errors: ValidationError[] = [];

  if (document.component !== expectedId) {
    errors.push(
      `document.component "${document.component}" does not match expected id "${expectedId}"`,
    );
  }

  if (!KEBAB_CASE_PATTERN.test(document.component)) {
    errors.push(`document.component "${document.component}" is not kebab-case`);
  }

  if (!document.summary || document.summary.trim() === '') {
    errors.push('document.summary must be a non-empty string');
  }

  const seenRuleIds = new Set<string>();
  for (const rule of document.rules) {
    if (!rule.id || rule.id.trim() === '') {
      errors.push('every rule must have a non-empty id');
      continue;
    }

    if (!KEBAB_CASE_PATTERN.test(rule.id)) {
      errors.push(`rule id "${rule.id}" is not kebab-case`);
    }

    if (seenRuleIds.has(rule.id)) {
      errors.push(`duplicate rule id "${rule.id}" within document`);
    }
    seenRuleIds.add(rule.id);

    if (!VALID_SEVERITIES.has(rule.severity)) {
      errors.push(
        `rule "${rule.id}" has invalid severity "${rule.severity}"; must be one of: error, warning, info`,
      );
    }

    if (!rule.description || rule.description.trim() === '') {
      errors.push(`rule "${rule.id}" must have a non-empty description`);
    }

    if (!rule.of || rule.of.length === 0) {
      errors.push(`rule "${rule.id}" must have at least one predicate in "of"`);
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

type ConstraintsJson = {
  $schema: string;
  component: string;
  summary: string;
  rules: ConstraintsDocument['rules'];
  examples?: ConstraintsDocument['examples'];
};

function serializeDocument(document: ConstraintsDocument): string {
  const output: ConstraintsJson = {
    $schema: SCHEMA_REF,
    component: document.component,
    summary: document.summary,
    // Sort rules by id for deterministic output.
    rules: document.rules.toSorted((a, b) => a.id.localeCompare(b.id)),
  };

  if (document.examples !== undefined) {
    output.examples = document.examples;
  }

  return JSON.stringify(output, null, 2) + '\n';
}

// ---------------------------------------------------------------------------
// Per-component processing
// ---------------------------------------------------------------------------

type ConstraintResult = {
  name: string;
  directory: string;
  json: string;
};

async function processConstraintsFile(
  directory: string,
  name: string,
): Promise<ConstraintResult | null> {
  const constraintsSourcePath = join(directory, `${name}.constraints.ts`);
  if (!existsSync(constraintsSourcePath)) {
    return null;
  }

  const module = await import(constraintsSourcePath);
  const document: unknown = module.default;

  if (!isConstraintsDocument(document)) {
    throw new Error(
      `${constraintsSourcePath}: default export must be a ConstraintsDocument (use defineConstraints)`,
    );
  }

  const errors = validateDocument(document, name);
  if (errors.length > 0) {
    const message = errors.map((e) => `  • ${e}`).join('\n');
    throw new Error(`${constraintsSourcePath}: validation failed:\n${message}`);
  }

  return {
    name,
    directory,
    json: serializeDocument(document),
  };
}

// ---------------------------------------------------------------------------
// Drift check
// ---------------------------------------------------------------------------

type DriftIssue = {
  name: string;
  file: string;
  reason: 'missing' | 'stale';
};

export async function checkConstraintsDrift(): Promise<DriftIssue[]> {
  const components = await discoverComponentDirectories();
  const issues: DriftIssue[] = [];

  for (const component of components) {
    const result = await processConstraintsFile(component.directory, component.name);
    if (result === null) continue;

    const outputPath = join(component.directory, `${component.name}.constraints.json`);
    const filename = `${component.name}.constraints.json`;

    if (!existsSync(outputPath)) {
      issues.push({ name: component.name, file: filename, reason: 'missing' });
      continue;
    }

    const onDisk = await Bun.file(outputPath).text();
    if (onDisk !== result.json) {
      issues.push({ name: component.name, file: filename, reason: 'stale' });
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Orchestrator-facing API
// ---------------------------------------------------------------------------

/**
 * Generates all constraints JSON files for components that have a
 * `{name}.constraints.ts` sidecar. Throws on validation failure.
 *
 * Called by the orchestrator (`generate-component-artifacts.ts`) as the
 * constraints stage. The standalone CLI entry point also calls this path.
 */
export async function generateAllConstraints(): Promise<number> {
  const components = await discoverComponentDirectories();
  let generatedCount = 0;

  for (const component of components) {
    const result = await processConstraintsFile(component.directory, component.name);
    if (result === null) continue;

    const outputPath = join(result.directory, `${result.name}.constraints.json`);
    await Bun.write(outputPath, result.json);
    generatedCount++;
  }

  return generatedCount;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const checkMode = args.includes('--check');

  if (checkMode) {
    const issues = await checkConstraintsDrift();
    if (issues.length === 0) {
      process.stdout.write('constraints:check — OK\n');
      return;
    }
    process.stderr.write(
      'constraints:check — drift detected. Run `bun run constraints:generate` to fix:\n',
    );
    for (const issue of issues) {
      process.stderr.write(`  • ${issue.name}/${issue.file} (${issue.reason})\n`);
    }
    process.exit(1);
  }

  // Generate mode: write all constraints JSON files.
  const components = await discoverComponentDirectories();
  let generatedCount = 0;

  for (const component of components) {
    let result: ConstraintResult | null;
    try {
      result = await processConstraintsFile(component.directory, component.name);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`error: ${message}\n`);
      process.exit(1);
    }

    if (result === null) continue;

    const outputPath = join(result.directory, `${result.name}.constraints.json`);
    await Bun.write(outputPath, result.json);
    process.stdout.write(`generated ${result.name}.constraints.json\n`);
    generatedCount++;
  }

  if (generatedCount === 0) {
    process.stdout.write('No constraints sidecars found.\n');
  }
}

if (import.meta.main) {
  await main();
}
