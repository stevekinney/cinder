/**
 * GENERATED FILE. Do not edit by hand.
 *
 * Types for the standalone format validator generated from
 * scripts/tokens/schemas/dtcg-format-2025-10.json.
 * Regenerate: bun run --filter=@lostgradient/cinder tokens:generate
 */

import type { ErrorObject } from 'ajv';

/** A compiled DTCG schema validator. `errors` is set by the most recent failing call. */
export type StandaloneValidator = ((data: unknown) => boolean) & {
  errors?: ErrorObject[] | null;
};

export const validate: StandaloneValidator;
declare const validator: StandaloneValidator;
export default validator;
