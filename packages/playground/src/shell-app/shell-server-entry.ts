import { render } from 'svelte/server';

import type { ComponentDocumentationPayload } from '../component-documentation-types.ts';
import Shell from './shell.svelte';

export type ShellServerProps = {
  initialComponent: string;
  components: string[];
  readmeHtml: string;
  documentation: ComponentDocumentationPayload | null;
  initialSearch: string;
};

export type RenderedShell = {
  body: string;
  head: string;
};

export function renderShellBody(props: ShellServerProps): RenderedShell {
  const rendered = render(Shell, { props });
  return { body: rendered.body, head: rendered.head };
}
