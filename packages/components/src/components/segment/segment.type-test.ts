/**
 * Compile-time regression tests for SegmentProps' link/button discriminant.
 */
import type { Snippet } from 'svelte';

import type { SegmentProps } from './segment.types.ts';

declare const children: Snippet;

const _buttonValid: SegmentProps = {
  value: 'actual',
  children,
};

const _navigationValid: SegmentProps = {
  href: '/costs?source=actual',
  current: true,
  currentToken: 'page',
  children,
};

const _navigationTrueToken: SegmentProps = {
  href: '/costs?source=actual',
  current: true,
  currentToken: 'true',
  children,
};

// @ts-expect-error - button segments require a value.
const _buttonMissingValue: SegmentProps = {
  children,
};

const _navigationFalseToken: SegmentProps = {
  href: '/costs?source=actual',
  current: true,
  // @ts-expect-error - current links must use a positive aria-current token.
  currentToken: false,
  children,
};

void _buttonValid;
void _navigationValid;
void _navigationTrueToken;
void _buttonMissingValue;
void _navigationFalseToken;
