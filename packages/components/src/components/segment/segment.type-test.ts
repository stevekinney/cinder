/**
 * Compile-time regression tests for SegmentProps' link/button discriminant.
 */
import type { Snippet } from 'svelte';

import type { SegmentProps } from './segment.types.ts';

declare const children: Snippet;

const buttonValid: SegmentProps = {
  value: 'actual',
  children,
};

const navigationValid: SegmentProps = {
  href: '/costs?source=actual',
  current: true,
  currentToken: 'page',
  target: '_blank',
  rel: 'noreferrer',
  children,
};

const navigationTrueToken: SegmentProps = {
  href: '/costs?source=actual',
  current: true,
  currentToken: 'true',
  children,
};

// @ts-expect-error - button segments require a value.
const buttonMissingValue: SegmentProps = {
  children,
};

const navigationFalseToken: SegmentProps = {
  href: '/costs?source=actual',
  current: true,
  // @ts-expect-error - current links must use a positive aria-current token.
  currentToken: false,
  children,
};

// @ts-expect-error - link-only attributes require href.
const buttonWithLinkOnlyAttribute: SegmentProps = {
  value: 'actual',
  target: '_blank',
  children,
};

void buttonValid;
void navigationValid;
void navigationTrueToken;
void buttonMissingValue;
void navigationFalseToken;
void buttonWithLinkOnlyAttribute;
