import { render } from 'svelte/server';

import Shell from './shell.svelte';

export type ShellServerProps = {
  components: string[];
  readmeHtml: string;
};

export type RenderedShell = {
  body: string;
  head: string;
};

export function renderShellBody(props: ShellServerProps): RenderedShell {
  const rendered = render(Shell, { props });
  return { body: rendered.body, head: rendered.head };
}
