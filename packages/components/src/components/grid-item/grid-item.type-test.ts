/**
 * Compile-time regression tests for GridItemProps' `as` narrowing.
 * svelte-check processes this file; tsc does not (it excludes .svelte imports).
 * These verify that document-metadata and non-content tags are rejected by
 * the type system.
 */
import type { Snippet } from 'svelte';

import type { GridItemProps } from './grid-item.svelte';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const noopChildren = null as any as Snippet;

// `script` is a document-metadata tag that renders no visible content as a
// wrapper — TypeScript must reject it.
const _asScript: GridItemProps = {
  // @ts-expect-error - "script" is excluded from NonMetadataHTMLElementTagName
  as: 'script',
  children: noopChildren,
};

// `title` is a document-metadata tag — TypeScript must reject it.
const _asTitle: GridItemProps = {
  // @ts-expect-error - "title" is excluded from NonMetadataHTMLElementTagName
  as: 'title',
  children: noopChildren,
};

void _asScript;
void _asTitle;
