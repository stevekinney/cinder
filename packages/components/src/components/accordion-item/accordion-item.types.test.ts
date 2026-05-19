/**
 * Type-equality test proving the per-directory migration did not drift the
 * public AccordionItem prop surface.
 */

import { expect, test } from 'bun:test';
import type { ComponentProps, Snippet } from 'svelte';

import AccordionItem from './accordion-item.svelte';
import type { AccordionItemProps } from './accordion-item.types.ts';

// Snapshot from src/components/accordion-item.svelte at the start of migration.
type SnapshotAccordionItemProps = {
  id: string;
  title: string;
  disabled?: boolean;
  class?: string;
  children: Snippet;
};

type Assignable<A, B> = A extends B ? true : false;

const aliasForward: Assignable<AccordionItemProps, SnapshotAccordionItemProps> = true;
const aliasBackward: Assignable<SnapshotAccordionItemProps, AccordionItemProps> = true;
const componentAcceptsSnapshot: Assignable<
  SnapshotAccordionItemProps,
  ComponentProps<typeof AccordionItem>
> = true;

test('AccordionItem public prop surface unchanged after migration', () => {
  expect(aliasForward).toBe(true);
  expect(aliasBackward).toBe(true);
  expect(componentAcceptsSnapshot).toBe(true);
});
