import { render } from 'svelte/server';

import type { ComponentDocumentationPayload } from '../component-documentation-types.ts';
import Shell from './shell.svelte';

export type ShellServerProps = {
  initialComponent: string;
  components: string[];
  readmeHtml: string;
  documentation: ComponentDocumentationPayload | null;
};

export function renderShellBody(props: ShellServerProps): string {
  return render(Shell, { props }).body;
}
