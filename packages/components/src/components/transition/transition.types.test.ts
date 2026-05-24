import { expect, test } from 'bun:test';
import { createRawSnippet } from 'svelte';
import { fade, fly } from 'svelte/transition';

import type { TransitionFunction, TransitionProps } from './transition.types.ts';

const typedSnippet = createRawSnippet(() => ({ render: () => '<span>Content</span>' }));

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

// Proves a consumer can type their own `(node, parameters)` transition as TransitionFunction
// without being forced to accept the internal `options` third argument.
const customTransition: TransitionFunction<{ scale: number }> = (_node, _parameters) => ({
  duration: 200,
});

test('TransitionProps accepts built-in Svelte transition functions', () => {
  expect(fadeProps.transition).toBe(fade);
  expect(flyProps.transition).toBe(fly);
  expect(customTransition).toBeDefined();
});
