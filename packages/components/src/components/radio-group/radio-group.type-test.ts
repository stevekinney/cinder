/**
 * Compile-time regression tests for the `RadioGroup` compound-component namespace.
 * svelte-check processes this file; tsc does not (it excludes .svelte imports).
 *
 * These verify that the `Object.assign` namespace members resolve and stay
 * correctly typed WITHOUT a hand-maintained `as typeof Root & { ... }` cast.
 * If `Option` is renamed in the `Object.assign` literal, the assignment below
 * stops compiling — surfacing the drift as a type error instead of silently
 * keeping the old declared type. (Mirrors accordion.type-test.ts.)
 */
import type { Component } from 'svelte';

import Radio from '../_radio/radio.svelte';
import { RadioGroup } from './index.ts';

const _option: typeof Radio = RadioGroup.Option;

RadioGroup satisfies Component<never>;

void _option;
