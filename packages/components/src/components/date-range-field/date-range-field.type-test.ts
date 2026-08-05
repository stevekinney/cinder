/**
 * Compile-time regression test for DateRangeFieldProps' required `id`.
 * svelte-check processes this file; tsc does not (it excludes .svelte imports).
 */
import type { DateRangeFieldProps } from './date-range-field.svelte';

// @ts-expect-error - id is required
const _missingId: DateRangeFieldProps = { granularity: 'day', label: 'Trip dates' };

void _missingId;
