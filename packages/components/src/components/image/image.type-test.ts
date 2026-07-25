/**
 * Compile-time regression tests for ImageProps.
 * svelte-check processes this file; tsc does not (it excludes .svelte imports).
 *
 * Image owns the native `<img>` load/error handlers so it can update internal
 * placeholder and fallback state before invoking the public camelCase callbacks.
 * Lowercase native handlers must stay off the public surface, otherwise rest
 * props can overwrite the internal handlers.
 */
import type { ImageProps } from './image.types.ts';

// @ts-expect-error - native onload is excluded so it cannot overwrite Image's internal handler
const _nativeLoadRejected: ImageProps = { src: '/photo.jpg', alt: 'Photo', onload: () => {} };

// @ts-expect-error - native onerror is excluded so it cannot overwrite Image's internal handler
const _nativeErrorRejected: ImageProps = { src: '/photo.jpg', alt: 'Photo', onerror: () => {} };

const _customHandlersAccepted: ImageProps = {
  src: '/photo.jpg',
  alt: 'Photo',
  onLoad: () => {},
  onError: () => {},
};

void _nativeLoadRejected;
void _nativeErrorRejected;
void _customHandlersAccepted;
