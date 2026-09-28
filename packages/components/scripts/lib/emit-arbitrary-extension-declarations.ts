import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname, join, normalize } from 'node:path';
import { Glob } from 'bun';

import {
  arbitraryExtensionDeclarationPath,
  findExtensionlessDeclarationSpecifiers,
  findMatchingReexportPath,
  findRelativeSpecifiers,
  findSelfReferentialTypeImports,
  findSideEffectRelativeSpecifiers,
  isArbitraryExtensionSpecifier,
} from './dist-relative-imports.ts';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface RewrittenSpecifier {
  readonly file: string;
  readonly from: string;
  readonly to: string;
}

export interface EmitArbitraryExtensionDeclarationsResult {
  /** `<base>.d.<ext>.ts` companions created, relative to `distDir`. */
  readonly createdDeclarations: readonly string[];
  /** Extensionless specifiers rewritten in place to carry the extension Node16 requires. */
  readonly rewrittenSpecifiers: readonly RewrittenSpecifier[];
  /** Bare `import(".").TypeName` self-references repointed at the correct sibling path. */
  readonly fixedSelfReferences: readonly RewrittenSpecifier[];
}

/**
 * Post-processes every `.d.ts` file under `distDir` so Node16/bundler ESM resolution — what a
 * real consumer's `"types"` condition uses, the same mode `attw` checks — can follow every
 * specifier the declaration emitter (`emitDts()` for cinder, `svelte-package` for chat/editor)
 * wrote. Two independent gaps, fixed in two passes:
 *
 *  - `.svelte`/`.css` specifiers need a `<base>.d.<ext>.ts` companion alongside the existing
 *    `<base>.<ext>.d.ts` one the Svelte ecosystem's own tooling emits. Node16 ESM-mode resolution
 *    (unlike its CJS-mode fallback path) only ever looks for the former — confirmed against real
 *    `tsc --traceResolution` output, not assumed; see `dist-relative-imports.ts`'s module doc for
 *    the trace. For `.svelte` the companion's content is copied from the existing sibling
 *    `<base>.svelte.d.ts` (the real declaration, just discoverable under the name Node16 looks
 *    for). For `.css` it is the empty `export {};` module declaration a side-effect-only import
 *    needs — nothing consumes a named export from a stylesheet.
 *  - a bare extensionless relative specifier (one component composing a sibling component's
 *    directory or file — e.g. `choice-grid`'s barrel importing `../choice-grid-item`) is rewritten
 *    in place to add the extension Node16 requires: `/index.js` when the target is a directory
 *    (it has its own `index.d.ts`), `.js` when it is a sibling file.
 *
 * Idempotent: re-running against an already-fixed `dist/` creates nothing and rewrites nothing.
 * Throws rather than silently skipping when a specifier cannot be resolved at all (no companion
 * source to copy, or no file/directory to rewrite the extension against) — that is a genuine build
 * defect the caller's build script should fail on, not paper over.
 */
export async function emitArbitraryExtensionDeclarations(
  distDir: string,
): Promise<EmitArbitraryExtensionDeclarationsResult> {
  const createdDeclarations: string[] = [];
  const rewrittenSpecifiers: RewrittenSpecifier[] = [];
  const fixedSelfReferences: RewrittenSpecifier[] = [];

  const glob = new Glob('**/*.d.ts');
  const relativeFiles: string[] = [];
  for await (const relative of glob.scan({ cwd: distDir })) relativeFiles.push(relative);
  relativeFiles.sort();

  // Pass 0: bare `import(".").TypeName` self-references. Each one is fixed by finding the same
  // file's own `export type { …, TypeName, … } from '<path>'` statement for that exact type — the
  // one place the file gets the relative path right — and repointing the `import(".")` there.
  // Runs before pass 1/2 so their specifier scans see the corrected path, not the bare `"."`
  // (which neither pass's specifier matcher would recognize as a specifier at all).
  for (const relative of relativeFiles) {
    const filePath = join(distDir, relative);
    const content = await Bun.file(filePath).text();
    const offenders = findSelfReferentialTypeImports(relative, content);
    if (offenders.length === 0) continue;

    let rewritten = content;
    for (const { typeName } of offenders) {
      const path = findMatchingReexportPath(content, typeName);
      if (!path) {
        throw new Error(
          `emitArbitraryExtensionDeclarations: ${relative} has a self-referential import(".").${typeName} ` +
            `but no 'export type { ${typeName} } from ...' statement in the same file to repair it from`,
        );
      }
      const pattern = new RegExp(`import\\(\\s*(['"])\\.\\1\\s*\\)\\.${typeName}\\b`, 'g');
      rewritten = rewritten.replace(pattern, (_match, quote: string) => {
        fixedSelfReferences.push({ file: relative, from: '.', to: path });
        return `import(${quote}${path}${quote}).${typeName}`;
      });
    }
    if (rewritten !== content) await Bun.write(filePath, rewritten);
  }

  // Pass 1: arbitrary-extension companions. Creating a file never invalidates another file's
  // already-collected specifier list, so this pass can run file-by-file without re-scanning.
  for (const relative of relativeFiles) {
    const filePath = join(distDir, relative);
    const content = await Bun.file(filePath).text();
    const directory = dirname(relative);
    const specifiers = [
      ...findRelativeSpecifiers(content),
      ...findSideEffectRelativeSpecifiers(content),
    ];

    for (const specifier of specifiers) {
      if (!isArbitraryExtensionSpecifier(specifier)) continue;
      const resolvedPath = normalize(join(directory, specifier));
      const declarationRelativePath = arbitraryExtensionDeclarationPath(resolvedPath);
      const declarationAbsolutePath = join(distDir, declarationRelativePath);
      if (existsSync(declarationAbsolutePath)) continue;

      const extension = specifier.slice(specifier.lastIndexOf('.'));
      let declarationContent: string;
      if (extension === '.css') {
        declarationContent = 'export {};\n';
      } else {
        // .svelte: the sibling `<base>.svelte.d.ts` emitDts()/svelte-package already wrote next
        // to the compiled file that imports it carries the real declaration.
        const legacyDeclarationAbsolutePath = join(distDir, `${resolvedPath}.d.ts`);
        if (!existsSync(legacyDeclarationAbsolutePath)) {
          throw new Error(
            `emitArbitraryExtensionDeclarations: ${relative} imports '${specifier}' but neither ` +
              `${declarationRelativePath} nor ${resolvedPath}.d.ts exists under ${distDir}`,
          );
        }
        declarationContent = await Bun.file(legacyDeclarationAbsolutePath).text();
      }

      await mkdir(dirname(declarationAbsolutePath), { recursive: true });
      await Bun.write(declarationAbsolutePath, declarationContent);
      createdDeclarations.push(declarationRelativePath);
    }
  }

  // Pass 2: extensionless specifier rewrites — text substitution, so re-read content fresh (pass
  // 1 never touched an existing `.d.ts`'s text, only pass 2 does, but re-reading keeps this pass
  // independent of pass 1's ordering).
  for (const relative of relativeFiles) {
    const filePath = join(distDir, relative);
    let content = await Bun.file(filePath).text();
    const directory = dirname(relative);
    const offenders = findExtensionlessDeclarationSpecifiers(relative, content);
    if (offenders.length === 0) continue;

    let changed = false;
    for (const { specifier } of offenders) {
      const resolvedAbsolutePath = join(distDir, normalize(join(directory, specifier)));
      let suffix: string;
      if (existsSync(`${resolvedAbsolutePath}/index.d.ts`)) {
        suffix = '/index.js';
      } else if (existsSync(`${resolvedAbsolutePath}.d.ts`)) {
        suffix = '.js';
      } else {
        throw new Error(
          `emitArbitraryExtensionDeclarations: ${relative} imports '${specifier}' but neither ` +
            `${resolvedAbsolutePath}/index.d.ts nor ${resolvedAbsolutePath}.d.ts exists`,
        );
      }
      const replacement = `${specifier}${suffix}`;
      const pattern = new RegExp(
        `(from\\s+|import\\(\\s*)(['"])${escapeRegExp(specifier)}\\2`,
        'g',
      );
      const nextContent = content.replace(pattern, (_match, prefix: string, quote: string) => {
        changed = true;
        rewrittenSpecifiers.push({ file: relative, from: specifier, to: replacement });
        return `${prefix}${quote}${replacement}${quote}`;
      });
      content = nextContent;
    }
    if (changed) await Bun.write(filePath, content);
  }

  return { createdDeclarations, rewrittenSpecifiers, fixedSelfReferences };
}
