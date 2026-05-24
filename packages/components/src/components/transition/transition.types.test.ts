import { expect, test } from 'bun:test';
import type { ComponentProps, Snippet } from 'svelte';
import { fade, fly } from 'svelte/transition';

import Transition from './transition.svelte';
import type { TransitionProps } from './transition.types.ts';

const typedSnippet = undefined as unknown as Snippet;

const fadeProps: TransitionProps<Parameters<typeof fade>[1]> = {
  show: true,
  children: typedSnippet,
  transition: fade,
  transitionParameters: { duration: 150 },
};

const flyProps: TransitionProps<Parameters<typeof fly>[1]> = {
  show: true,
  children: typedSnippet,
  transition: fly,
  transitionParameters: { x: 8, duration: 150 },
};

const componentProps: ComponentProps<typeof Transition> = {
  show: true,
  children: typedSnippet,
  transition: fly,
  transitionParameters: { x: 8, duration: 150 },
};

test('TransitionProps accepts built-in Svelte transition functions', () => {
  expect(fadeProps.transition).toBe(fade);
  expect(flyProps.transition).toBe(fly);
  expect(componentProps['transition']).toBe(fly);
});
