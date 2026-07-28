/**
 * Server-render entry for the canonical component documentation page.
 *
 * Mirrors `shell-app/shell-server-entry.ts`: the playground server compiles this
 * module with `sveltePlugin({ generate: 'server' })` and calls
 * {@link renderComponentPageBody} to obtain the documentation markup plus the
 * scoped `<style>` tags Svelte hoists into `<head>`. The client bundle then
 * hydrates that exact tree.
 *
 * Every input is passed explicitly. `component-page.svelte` must never read
 * `window`/`document` during initialization, or the server and client first
 * render disagree and hydration mismatches.
 */

import { render } from 'svelte/server';

import type { ComponentDocumentationPayload } from './component-documentation-types.ts';
import ComponentPage from './component-page.svelte';

/** One `*.example.svelte` scenario registered for a component. */
export type ComponentPageExample = {
  scenario: string;
  title: string;
  description?: string;
  featured?: boolean;
};

export type ComponentPageServerProps = {
  componentName: string;
  documentation: ComponentDocumentationPayload;
  examples: ComponentPageExample[];
  /** Sidebar navigation entries, rendered inside the page's own tree. */
  sidebarComponents: string[];
};

/** Landing page (`/`) — same chrome, README instead of documentation. */
export type LandingServerProps = {
  readmeHtml: string;
  sidebarComponents: string[];
};

export type RenderedComponentPage = {
  body: string;
  head: string;
};

/**
 * Render the documentation page to HTML strings.
 *
 * `snapshotMode` is pinned to `false`: the `?snapshot=1` surface is served by a
 * separate client-only code path so the visual-regression and axe suites keep
 * their exact `#app > *` mount contract. `bareComponentModule` is intentionally
 * omitted — the live playground mount is a client-only concern, and the stage
 * reserves its box during SSR so hydration adds no layout shift.
 */
/**
 * Render the landing page through the SAME component as every documentation
 * page, so `/` and `/page/<name>` share one chrome. Before this the landing
 * page ran a separate shell with its own theme control, its own sidebar markup
 * and its own label casing.
 */
export function renderLandingBody(props: LandingServerProps): RenderedComponentPage {
  const rendered = render(ComponentPage, {
    props: {
      componentName: '',
      readmeHtml: props.readmeHtml,
      sidebarComponents: props.sidebarComponents,
      snapshotMode: false,
    },
  });

  return { body: rendered.body, head: rendered.head };
}

export function renderComponentPageBody(props: ComponentPageServerProps): RenderedComponentPage {
  const rendered = render(ComponentPage, {
    props: {
      componentName: props.componentName,
      documentation: props.documentation,
      documentationError: null,
      examples: props.examples,
      sidebarComponents: props.sidebarComponents,
      snapshotMode: false,
    },
  });

  return { body: rendered.body, head: rendered.head };
}
