/**
 * Type-equality test proving the per-directory migration did not drift the
 * public Accordion prop surface.
 */

import { expect, test } from 'bun:test';
import type { ComponentProps, Snippet } from 'svelte';

import Accordion from './accordion.svelte';
import type { AccordionProps } from './accordion.types.ts';

// Snapshot from src/components/accordion.svelte at the start of migration.
type SnapshotAccordionProps = {
  multiple?: boolean;
  expandedIds: string[];
  class?: string;
  children: Snippet;
};

type Assignable<A, B> = A extends B ? true : false;

const aliasForward: Assignable<AccordionProps, SnapshotAccordionProps> = true;
const aliasBackward: Assignable<SnapshotAccordionProps, AccordionProps> = true;
const componentAcceptsSnapshot: Assignable<
  SnapshotAccordionProps,
  ComponentProps<typeof Accordion>
> = true;

test('Accordion public prop surface unchanged after migration', () => {
  expect(aliasForward).toBe(true);
  expect(aliasBackward).toBe(true);
  expect(componentAcceptsSnapshot).toBe(true);
});
