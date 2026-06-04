/**
 * Materializes every published example into a compilable Svelte component and
 * generates a route that renders all of them, each wrapped in a marker carrying
 * its COMPOSITE id `${componentId}::${exampleId}`. The validator then SSR-renders
 * the route and asserts every composite id appears EXACTLY ONCE.
 *
 * Why composite ids: bare example ids (`basic`, `default`, `variants`) repeat
 * across components, so an exact-once assertion on bare ids is ambiguous. The
 * marker and the expected set both use the UNSANITIZED composite id; only the
 * on-disk filename is sanitized.
 *
 * The unit of coverage is every `examples[]` ENTRY across every component the
 * manifest marks with an `artifacts.examples` subpath — NOT "93 JSON files"
 * (a file holds multiple entries).
 *
 * Reads the INSTALLED tarball's manifest + examples JSON (via createRequire), so
 * coverage tracks exactly what the package publishes. Deletes `src/generated`
 * first — stale output must never survive a run.
 *
 * Node baseline: 22+. JSON via createRequire (no import attributes).
 */

import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const generatedExamplesDirectory = join(here, 'src', 'generated', 'examples');
const routePageFile = join(here, 'src', 'routes', '+page.svelte');
const manifestFile = join(here, 'src', 'generated', 'expected-example-ids.json');

const manifest = require('@lostgradient/cinder/manifest');
const componentsWithExamples = manifest.components.filter(
  (component) => component.artifacts.examples,
);
if (componentsWithExamples.length === 0) {
  process.stderr.write('generate-examples: manifest has no components with examples\n');
  process.exit(1);
}

if (existsSync(join(here, 'src', 'generated'))) {
  rmSync(join(here, 'src', 'generated'), { recursive: true, force: true });
}
mkdirSync(generatedExamplesDirectory, { recursive: true });

/**
 * Sanitize a composite id (`${componentId}::${exampleId}`) for use as a
 * filename and JS import identifier.
 *
 * Component ids and example ids are constrained to `^[a-z][a-z0-9-]*$` — the
 * only non-alphanumeric character in each part is `-`. We split on `::` first,
 * replace hyphens with underscores in each part, then rejoin with `__` (double
 * underscore). This keeps the componentId/exampleId boundary unambiguous:
 *
 *   `button-group::basic`  → `button_group__basic`
 *   `button::group-basic`  → `button__group_basic`  (distinct from the above)
 *
 * A flat replace of all non-alphanumeric chars collapses both `-` and `::` to
 * a single `_`, which is lossy — both examples above would produce
 * `button_group_basic`, causing a silent filename and identifier collision.
 */
function sanitize(value) {
  return value
    .split('::')
    .map((part) => part.replace(/-/g, '_'))
    .join('__');
}

// The marker attribute and the validator's extraction regex assume composite ids
// contain no characters that need HTML-attribute escaping (notably `"`). The
// manifest schema constrains component ids and example ids to this pattern, so
// this is a guard that fails loud if that contract ever changes — rather than
// silently emitting a marker the validator cannot parse.
const SAFE_ID = /^[a-z][a-z0-9-]*$/;

const imports = [];
const renders = [];
const expectedCompositeIds = [];
let entryCount = 0;

for (const component of componentsWithExamples) {
  // Resolve the examples sidecar through the package's own export — the same
  // specifier a real consumer would import.
  const exampleSet = require(component.artifacts.examples);
  if (!Array.isArray(exampleSet.examples)) {
    process.stderr.write(`generate-examples: ${component.id} examples is not an array\n`);
    process.exit(1);
  }

  if (!SAFE_ID.test(component.id)) {
    process.stderr.write(
      `generate-examples: component id "${component.id}" is not attribute-safe (${SAFE_ID}); ` +
        `the data-example-id marker contract requires it.\n`,
    );
    process.exit(1);
  }

  const seenExampleIds = new Set();
  for (const example of exampleSet.examples) {
    if (!SAFE_ID.test(example.id)) {
      process.stderr.write(
        `generate-examples: ${component.id} example id "${example.id}" is not attribute-safe (${SAFE_ID}).\n`,
      );
      process.exit(1);
    }
    if (seenExampleIds.has(example.id)) {
      process.stderr.write(
        `generate-examples: ${component.id} has duplicate example id "${example.id}" — ` +
          `composite ids must be unique for the exact-once render assertion.\n`,
      );
      process.exit(1);
    }
    seenExampleIds.add(example.id);

    const compositeId = `${component.id}::${example.id}`;
    expectedCompositeIds.push(compositeId);
    entryCount += 1;

    const identifier = `Example_${sanitize(compositeId)}`;
    const fileName = `${sanitize(compositeId)}.svelte`;
    writeFileSync(join(generatedExamplesDirectory, fileName), `${example.code}\n`);

    imports.push(`  import ${identifier} from '../generated/examples/${fileName}';`);
    // The marker uses the UNSANITIZED composite id. Render the example inside it.
    renders.push(
      `  <div data-example-id=${JSON.stringify(compositeId)}>` + `<${identifier} /></div>`,
    );
  }
}

const pageLines = [
  '<!-- AUTO-GENERATED by generate-examples.mjs — do not edit. -->',
  '<script lang="ts">',
  ...imports,
  '</script>',
  '',
  '<main>',
  ...renders,
  '</main>',
  '',
];
writeFileSync(routePageFile, pageLines.join('\n'));

// Persist the expected composite-id set so the validator asserts against the
// exact set this run produced (not a recomputed guess).
writeFileSync(
  manifestFile,
  JSON.stringify({ entryCount, compositeIds: expectedCompositeIds }, null, 2) + '\n',
);

process.stdout.write(
  `generate-examples: materialized ${entryCount} example entries across ` +
    `${componentsWithExamples.length} components\n`,
);
