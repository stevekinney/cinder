import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ScreenshotMetadata } from '../src/helpers/screenshot-metadata.ts';

type ContactSheetOptions = {
  metadataRoot: string;
  outputRoot: string;
};

type ContactSheetResult = {
  sidecars: number;
  categories: string[];
  indexPath: string;
};

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, '..');

function defaultOptions(): ContactSheetOptions {
  return {
    metadataRoot: resolve(packageRoot, 'test-results', 'visual-metadata'),
    outputRoot: resolve(packageRoot, 'test-results', 'contact-sheets'),
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function htmlPath(value: string): string {
  return value.replaceAll(sep, '/');
}

async function readSidecars(metadataRoot: string): Promise<ScreenshotMetadata[]> {
  if (!existsSync(metadataRoot)) return [];

  const glob = new Bun.Glob('**/*.json');
  const entries: ScreenshotMetadata[] = [];
  for await (const relativePath of glob.scan({ cwd: metadataRoot })) {
    const metadataPath = resolve(metadataRoot, relativePath);
    const contents = await readFile(metadataPath, 'utf8');
    const metadata = JSON.parse(contents) as ScreenshotMetadata;
    if (!existsSync(metadata.screenshotPath)) {
      throw new Error(
        `Contact sheet metadata references a missing screenshot:\n  metadata: ${metadataPath}\n  screenshot: ${metadata.screenshotPath}`,
      );
    }
    entries.push(metadata);
  }

  return entries.toSorted((a, b) =>
    [a.category, a.slug, a.fixture, a.theme, a.viewport]
      .join('/')
      .localeCompare([b.category, b.slug, b.fixture, b.theme, b.viewport].join('/')),
  );
}

function renderCategorySheet(
  category: string,
  entries: readonly ScreenshotMetadata[],
  outputPath: string,
): string {
  const cards = entries
    .map((entry) => {
      const imageSource = htmlPath(relative(dirname(outputPath), entry.screenshotPath));
      const steps =
        entry.interact.length > 0
          ? `<p class="meta">interaction steps: ${entry.interact.length}</p>`
          : '';
      return `
        <article class="card">
          <img src="${escapeHtml(imageSource)}" alt="${escapeHtml(
            `${entry.component} ${entry.fixture} ${entry.theme} ${entry.viewport}`,
          )}" loading="lazy" />
          <h2>${escapeHtml(entry.component)}</h2>
          <p class="meta">${escapeHtml(entry.slug)} / ${escapeHtml(entry.fixture)}</p>
          <p class="meta">${escapeHtml(entry.theme)} / ${escapeHtml(entry.viewport)}</p>
          ${steps}
        </article>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(category)} contact sheet</title>
    <style>
      body {
        margin: 0;
        background: #f7f7f8;
        color: #18181b;
        font-family: ui-sans-serif, system-ui, sans-serif;
      }
      main {
        padding: 24px;
      }
      h1 {
        margin: 0 0 16px;
        font-size: 24px;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 16px;
      }
      .card {
        border: 1px solid #d4d4d8;
        border-radius: 8px;
        background: white;
        overflow: hidden;
      }
      img {
        display: block;
        inline-size: 100%;
        aspect-ratio: 16 / 9;
        object-fit: contain;
        background: #ffffff;
        border-block-end: 1px solid #e4e4e7;
      }
      h2 {
        margin: 12px 12px 4px;
        font-size: 15px;
      }
      .meta {
        margin: 4px 12px 12px;
        color: #52525b;
        font-size: 12px;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>${escapeHtml(category)}</h1>
      <section class="grid">${cards}</section>
    </main>
  </body>
</html>
`;
}

function renderIndex(categories: readonly string[]): string {
  const links =
    categories.length > 0
      ? categories
          .map(
            (category) =>
              `<li><a href="${escapeHtml(`${category}.html`)}">${escapeHtml(category)}</a></li>`,
          )
          .join('\n')
      : '<li>No screenshot metadata sidecars found.</li>';

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Cinder contact sheets</title>
  </head>
  <body>
    <main>
      <h1>Cinder contact sheets</h1>
      <ul>${links}</ul>
    </main>
  </body>
</html>
`;
}

export async function generateContactSheets(
  options: Partial<ContactSheetOptions> = {},
): Promise<ContactSheetResult> {
  const resolvedOptions = { ...defaultOptions(), ...options };
  const sidecars = await readSidecars(resolvedOptions.metadataRoot);
  const byCategory = new Map<string, ScreenshotMetadata[]>();

  for (const sidecar of sidecars) {
    const categoryEntries = byCategory.get(sidecar.category) ?? [];
    categoryEntries.push(sidecar);
    byCategory.set(sidecar.category, categoryEntries);
  }

  await mkdir(resolvedOptions.outputRoot, { recursive: true });
  const categories = [...byCategory.keys()].toSorted();
  for (const category of categories) {
    const outputPath = resolve(resolvedOptions.outputRoot, `${category}.html`);
    await writeFile(
      outputPath,
      renderCategorySheet(category, byCategory.get(category) ?? [], outputPath),
    );
  }

  const indexPath = resolve(resolvedOptions.outputRoot, 'index.html');
  await writeFile(indexPath, renderIndex(categories));

  return { sidecars: sidecars.length, categories, indexPath };
}

if (import.meta.main) {
  generateContactSheets()
    .then((result) => {
      process.stdout.write(
        `contact-sheets: wrote ${result.categories.length} category sheet(s) from ${result.sidecars} sidecar(s) to ${result.indexPath}\n`,
      );
    })
    .catch((error: unknown) => {
      console.error('contact-sheets failed:', error);
      process.exit(1);
    });
}
