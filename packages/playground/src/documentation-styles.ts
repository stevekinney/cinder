import { join } from 'node:path';

import { PLAYGROUND_ROOT } from './playground-paths.ts';

/**
 * Cinder primitives rendered by the documentation chrome and its colour-token
 * panel. Their styles are bundled once for every documentation route; the
 * documented component and its example dependencies are added separately.
 */
export const DOCUMENTATION_CINDER_COMPONENTS = [
  'accordion',
  'alert',
  'badge',
  'button',
  'callout',
  'code-block',
  'collapsible',
  'color-picker',
  'color-swatch-picker',
  'copy-button',
  'kbd',
  'input',
  'popover',
  'status-dot',
  'table',
  'toggle',
  'tooltip',
] as const;

/** Cinder primitives rendered by the landing shell and its colour-token panel. */
export const LANDING_CINDER_COMPONENTS = [
  'button',
  'color-picker',
  'color-swatch-picker',
  'copy-button',
  'input',
  'popover',
  'tooltip',
] as const;

export type PlaygroundStylesheetName = 'documentation' | 'landing';

const componentsByStylesheet: Readonly<Record<PlaygroundStylesheetName, readonly string[]>> = {
  documentation: DOCUMENTATION_CINDER_COMPONENTS,
  landing: LANDING_CINDER_COMPONENTS,
};
const stylesheetPromiseByName = new Map<PlaygroundStylesheetName, Promise<string>>();

function formatBuildLogs(logs: readonly { message: string }[]): string {
  return logs.map(({ message }) => message).join('\n');
}

/** Drop cached styles after a source invalidation so live reload serves fresh CSS. */
export function resetPlaygroundStylesheetBuilds(): void {
  stylesheetPromiseByName.clear();
}

function stylesheetEntry(components: readonly string[]): string {
  const imports = components
    .map((componentName) => `@import '@lostgradient/cinder/${componentName}/styles';`)
    .join('\n');
  return `@import '@lostgradient/cinder/styles';
${imports}
`;
}

/** Bundle the documentation CSS graph so each page needs one shared stylesheet. */
export function buildPlaygroundStylesheet(name: PlaygroundStylesheetName): Promise<string> {
  const existing = stylesheetPromiseByName.get(name);
  if (existing !== undefined) return existing;

  const stylesheetPromise = (async () => {
    // Bun caches a virtual build by its entrypoint path. Keep that path unique
    // per stylesheet or a landing request can receive the documentation graph.
    const virtualEntrypoint = join(PLAYGROUND_ROOT, 'src', `.${name}-styles.css`);
    const result = await Bun.build({
      entrypoints: [virtualEntrypoint],
      files: { [virtualEntrypoint]: stylesheetEntry(componentsByStylesheet[name]) },
      minify: true,
      target: 'browser',
    });
    if (!result.success) {
      throw new Error(
        `[playground] ${name} stylesheet build failed:\n${formatBuildLogs(result.logs)}`,
      );
    }
    const stylesheet = result.outputs.find((output) => output.path.endsWith('.css'));
    if (stylesheet === undefined) {
      throw new Error('[playground] documentation stylesheet build produced no CSS output');
    }
    return await stylesheet.text();
  })().catch((error: unknown) => {
    stylesheetPromiseByName.delete(name);
    throw error;
  });
  stylesheetPromiseByName.set(name, stylesheetPromise);
  return stylesheetPromise;
}

/** Bundle the shared documentation CSS graph. */
export function buildDocumentationStylesheet(): Promise<string> {
  return buildPlaygroundStylesheet('documentation');
}

/** Bundle the landing CSS graph without unrelated documentation primitives. */
export function buildLandingStylesheet(): Promise<string> {
  return buildPlaygroundStylesheet('landing');
}
