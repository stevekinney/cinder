import { Glob } from 'bun';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(scriptDirectory, '..');
const repositoryRoot = resolve(packageRoot, '..', '..');
const documentationPath = 'docs/component-api-conventions.md';
const componentsDirectory = resolve(packageRoot, 'src', 'components');

export const bannedNames = new Map<string, string>([
  ['defaultValue', 'Use bindable `value` plus a private reset target.'],
  ['filterItem', 'Use `filter`.'],
  ['fieldClass', 'Use `fieldClassName`.'],
  ['inputValue', 'Use `textInputValue`.'],
  ['component', 'Use `as`.'],
  ['mono', 'Use `monospace` (the abbreviation expands to the typeface meaning, not a color word).'],
  [
    'monochrome',
    'Use `monospace` — the prop renders a monospace font; `monochrome` is color vocabulary.',
  ],
  ['colSpan', 'Use `columnSpan`.'],
  ['lockScroll', 'Use `scrollLocked`.'],
  ['onClick', 'Use Svelte native `onclick`.'],
  ['cta', 'Use `callToActionLabel`.'],
  ['hideLabel', 'Use `labelVisible` (default `true`).'],
  ['labelledBy', 'Use `ariaLabelledby`.'],
  ['ariaLabelledBy', 'Use `ariaLabelledby` (lowercase b, matching the aria-labelledby attribute).'],
  [
    'draggable',
    'Collides with the native `draggable` attribute — use `reorderHandleVisible` or `dragHandleVisible`.',
  ],
  ['disallowEmptySelection', 'Use `selectionRequired`.'],
  ['disableTypeahead', 'Use `typeaheadDisabled`.'],
  ['onLoadmore', 'Use `onLoadMore`.'],
  ['onSelectall', 'Use `onSelectAll`.'],
  ['onFilterchange', 'Use `onFilterChange`.'],
]);

export type PropConventionViolation = {
  filePath: string;
  line: number;
  propName: string;
  message: string;
};

function lineFor(sourceFile: ts.SourceFile, position: number): number {
  return sourceFile.getLineAndCharacterOfPosition(position).line + 1;
}

function propertyNameText(name: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  return undefined;
}

function checkPropName(
  sourceFile: ts.SourceFile,
  filePath: string,
  name: ts.PropertyName,
): PropConventionViolation[] {
  const propName = propertyNameText(name);
  if (!propName) return [];

  const violations: PropConventionViolation[] = [];
  const line = lineFor(sourceFile, name.getStart(sourceFile));
  const bannedMessage = bannedNames.get(propName);

  if (bannedMessage) {
    violations.push({ filePath, line, propName, message: bannedMessage });
  }

  // Polarity prefixes (show*/hide*/disable*, …) are NOT judged here either:
  // the ban is about boolean polarity, and `hideDelay?: number` is a duration,
  // not a flag — so it is a type question the type-aware pass answers.

  // Lowercase on* names are NOT judged here: any name can be a legitimate
  // native passthrough (onpointerdown, onwheel, …), so the distinction is a
  // type question — the type-aware pass classifies each lowercase handler by
  // whether its first parameter extends Event.

  return violations;
}

function isExported(node: ts.Node): boolean {
  return ts.canHaveModifiers(node)
    ? (ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ??
        false)
    : false;
}

function isComponentPropsSurfaceName(name: string): boolean {
  return (name === 'Props' || name.endsWith('Props')) && !name.endsWith('SchemaProps');
}

function collectTypeNodePropViolations(
  sourceFile: ts.SourceFile,
  filePath: string,
  typeNode: ts.TypeNode,
): PropConventionViolation[] {
  if (ts.isTypeLiteralNode(typeNode)) {
    return typeNode.members.flatMap((member) =>
      ts.isPropertySignature(member) ? checkPropName(sourceFile, filePath, member.name) : [],
    );
  }

  if (ts.isIntersectionTypeNode(typeNode) || ts.isUnionTypeNode(typeNode)) {
    return typeNode.types.flatMap((child) =>
      collectTypeNodePropViolations(sourceFile, filePath, child),
    );
  }

  if (ts.isParenthesizedTypeNode(typeNode)) {
    return collectTypeNodePropViolations(sourceFile, filePath, typeNode.type);
  }

  return [];
}

export function collectPropConventionViolations(
  source: string,
  filePath = 'fixture.types.ts',
): PropConventionViolation[] {
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true);
  const violations: PropConventionViolation[] = [];

  for (const statement of sourceFile.statements) {
    if (
      ts.isInterfaceDeclaration(statement) &&
      isExported(statement) &&
      isComponentPropsSurfaceName(statement.name.text)
    ) {
      violations.push(
        ...statement.members.flatMap((member) =>
          ts.isPropertySignature(member) ? checkPropName(sourceFile, filePath, member.name) : [],
        ),
      );
    }

    if (
      ts.isTypeAliasDeclaration(statement) &&
      isExported(statement) &&
      isComponentPropsSurfaceName(statement.name.text)
    ) {
      violations.push(...collectTypeNodePropViolations(sourceFile, filePath, statement.type));
    }
  }

  return violations;
}

// ---------------------------------------------------------------------------
// Type-aware pass. The syntactic pass above cannot tell a native DOM
// passthrough (`onclick?: (event: MouseEvent) => void`) from a custom value
// callback hiding behind a native name (`onchange?: (value: string) => void`)
// — which is exactly how 20+ components drifted before the 2026-08 sweep.
// One ts.Program over every *.types.ts resolves each exported Props surface's
// properties through aliases, intersections, unions, and indexed accesses,
// then gates every lowercase on* handler on its first parameter structurally
// extending Event. The same resolution gates the show*/hide*/disable*
// polarity ban on the property's type actually being boolean-like.
// Resolving the SURFACE (not the syntax tree) also closes
// the non-exported-helper blind spot: a violation is attributed to its true
// declaration site even when that declaration lives in an unexported type
// referenced by the exported Props.
// ---------------------------------------------------------------------------

const EVENT_STRUCTURAL_PROBE = ['preventDefault', 'stopPropagation', 'bubbles'] as const;

function isNullishType(type: ts.Type): boolean {
  return (type.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Null | ts.TypeFlags.Never)) !== 0;
}

/**
 * A parameter type is Event-like when every non-nullish union constituent
 * structurally exposes `preventDefault`, `stopPropagation`, and `bubbles`.
 * The structural probe passes MouseEvent/KeyboardEvent/SubmitEvent and the
 * event side of `svelte/elements` handler unions, and fails `string`,
 * `number | null`, `File[]`, and detail objects — without depending on
 * lib.dom declaration names.
 */
function isEventLikeParameterType(type: ts.Type): boolean {
  const constituents = type.isUnion() ? type.types : [type];
  const substantive = constituents.filter((constituent) => !isNullishType(constituent));
  if (substantive.length === 0) return false;
  return substantive.every((constituent) =>
    EVENT_STRUCTURAL_PROBE.every((probe) => constituent.getProperty(probe) !== undefined),
  );
}

/**
 * Whether a lowercase native-named handler prop's resolved type is a real
 * DOM passthrough: every call signature takes an Event-like first parameter.
 * An undefined/never-only arm (a discriminated-union fence) passes — there
 * is nothing callable to misuse.
 */
function isNativePassthroughHandlerType(propType: ts.Type, checker: ts.TypeChecker): boolean {
  const constituents = propType.isUnion() ? propType.types : [propType];
  const callable = constituents.filter((constituent) => !isNullishType(constituent));
  // Nullish-only types are discriminated-union fence arms (`onclick?: undefined`).
  if (callable.length === 0) return true;
  // A lowercase on* prop must BE a handler: every non-nullish constituent has
  // to be callable, or the prop is not a native passthrough at all
  // (`onchange?: string`, `((event: Event) => void) | string`).
  if (callable.some((constituent) => constituent.getCallSignatures().length === 0)) {
    return false;
  }
  const signatures = callable.flatMap((constituent) => constituent.getCallSignatures());
  return signatures.every((signature) => {
    const firstParameter = signature.getParameters()[0];
    if (!firstParameter) return false;
    const declaration = firstParameter.valueDeclaration ?? firstParameter.declarations?.[0];
    if (!declaration) return false;
    const parameterType = checker.getTypeOfSymbolAtLocation(firstParameter, declaration);
    return isEventLikeParameterType(parameterType);
  });
}

const booleanPrefixPattern = /^(show|allow|use|hide|disable|disallow)[A-Z]/;

/**
 * Words, not their order, identify a public prop concept. `onValueChange`
 * and `onChangeValue` therefore collide even when neither spelling appears
 * in the frozen redirect vocabulary. That catches novel duplicate names
 * without pretending a static checker can infer unrelated English synonyms.
 */
export function propConceptKey(propName: string): string | undefined {
  if (propName === 'class' || propName.startsWith('aria-') || propName.startsWith('data-')) {
    return undefined;
  }
  const words = propName.match(/[A-Z]+(?=[A-Z][a-z]|$)|[A-Z]?[a-z]+|\d+/g);
  return words && words.length > 1
    ? words
        .map((word) => word.toLowerCase())
        .toSorted()
        .join('\u0000')
    : undefined;
}

// `any`/`unknown` tell the checker nothing, so the name-based ban stands
// rather than silently lapsing on exactly the surfaces the checker is least
// able to vouch for.
const OPAQUE_TYPE_FLAGS = ts.TypeFlags.Any | ts.TypeFlags.Unknown;

// Types whose resolution waits on a type argument, so no instantiation-time
// answer exists during the surface scan.
const DEFERRED_TYPE_FLAGS = ts.TypeFlags.Conditional | ts.TypeFlags.IndexedAccess;

/**
 * Whether a polarity-prefixed prop can actually hold a boolean, which is the
 * only case the show/hide/disable prefix ban is about. `boolean` resolves to a
 * `true | false` union, so the probe runs per constituent after dropping the
 * nullish and `never` arms; an arm left with nothing substantive is a
 * discriminated-union fence with no value to set, and an opaque type keeps
 * the ban.
 */
function isBooleanLikePropType(type: ts.Type, checker: ts.TypeChecker): boolean {
  const constituents = type.isUnion() ? type.types : [type];
  const substantive = constituents.filter((constituent) => !isNullishType(constituent));
  if (substantive.length === 0) return false;
  return substantive.some((constituent) => canHoldBoolean(constituent, checker));
}

function canHoldBoolean(type: ts.Type, checker: ts.TypeChecker): boolean {
  if ((type.flags & ts.TypeFlags.BooleanLike) !== 0) return true;

  // `NoInfer<T>` and friends wrap the real type in a substitution — three
  // Props surfaces here already use it — so unwrap to what the consumer
  // actually sets.
  const substituted = substitutionBaseType(type);
  if (substituted) return canHoldBoolean(substituted, checker);

  // A branded boolean (`boolean & { readonly __brand: unique symbol }`) is set
  // with a boolean, but the whole `boolean` type is not assignable to the
  // intersection, so the probe below would clear it. Only a constituent that
  // is ITSELF boolean counts: probing `canHoldBoolean` per constituent would
  // ban `number & {}`, since `{}` admits a boolean on its own.
  if (type.isIntersection()) {
    return type.types.some((constituent) => contributesBoolean(constituent, checker));
  }

  // A bare type parameter says nothing on its own, but its constraint does:
  // `Item extends { id: string }` can never be a boolean, so a generic
  // `showItem?: Item` is the same false positive as `hideDelay?: number`.
  // An unconstrained parameter still keeps the ban.
  if ((type.flags & ts.TypeFlags.TypeParameter) !== 0) {
    const constraint = checker.getBaseConstraintOfType(type);
    return constraint ? isBooleanLikePropType(constraint, checker) : true;
  }
  // A deferred type — an unresolved conditional or indexed access — has no
  // single answer while the generic surface is being scanned. Nothing is
  // assignable to `T extends true ? boolean : number` yet, so the probe below
  // would clear it even though `Props<true>` exposes a boolean. Keep the ban,
  // as with any other type the checker cannot vouch for.
  //
  // This is deliberately fail-closed rather than branch-inspecting: a
  // deferred type whose every branch is non-boolean gets a false positive,
  // which an author escapes by renaming one prop, whereas the opposite bias
  // reopens the silent hole this pass exists to close.
  if ((type.flags & DEFERRED_TYPE_FLAGS) !== 0) return true;

  // The real question for everything else is assignability: can this type
  // hold `true`? Flags cannot answer it — `{}`, `unknown`, `Boolean` and
  // `{ valueOf(): boolean }` all accept a boolean while carrying no
  // BooleanLike flag, and `{ id: string }` rejects one.
  const assignable = booleanAssignableTo(type, checker);
  if (assignable !== undefined) return assignable;

  // Fallback when the checker's assignability surface is gone. A structural
  // type only excludes booleans when it demands something a boolean lacks,
  // which is right for `{}` versus `{ id: string }` but misses the wrapper
  // shapes above — hence the probe first.
  if ((type.flags & ts.TypeFlags.Object) !== 0) {
    const demandsMembers =
      checker.getPropertiesOfType(type).length > 0 ||
      checker.getIndexInfosOfType(type).length > 0 ||
      checker.getSignaturesOfType(type, ts.SignatureKind.Call).length > 0 ||
      checker.getSignaturesOfType(type, ts.SignatureKind.Construct).length > 0;
    return !demandsMembers;
  }
  return (type.flags & OPAQUE_TYPE_FLAGS) !== 0;
}

/**
 * `NoInfer<T>` and other substitutions carry the real type in `baseType`,
 * which is not on the public `Type` surface — widen with an optional member
 * rather than narrowing to `ts.SubstitutionType`, which the type-aware lint
 * rejects as an unsafe assertion.
 */
type SubstitutionLike = { baseType?: ts.Type };

function substitutionBaseType(type: ts.Type): ts.Type | undefined {
  if ((type.flags & ts.TypeFlags.Substitution) === 0) return undefined;
  return (type as ts.Type & SubstitutionLike).baseType;
}

/**
 * Whether a single intersection constituent is itself boolean, after
 * unwrapping the indirections that hide one. Deliberately narrower than
 * `canHoldBoolean`: a constituent that merely ADMITS a boolean (`{}`,
 * `unknown`) constrains nothing, so it must not make `number & {}` read as a
 * boolean prop.
 */
function contributesBoolean(type: ts.Type, checker: ts.TypeChecker): boolean {
  if ((type.flags & ts.TypeFlags.BooleanLike) !== 0) return true;
  const substituted = substitutionBaseType(type);
  if (substituted) return contributesBoolean(substituted, checker);
  if ((type.flags & ts.TypeFlags.TypeParameter) !== 0) {
    const constraint = checker.getBaseConstraintOfType(type);
    return constraint ? contributesBoolean(constraint, checker) : false;
  }
  if (type.isUnion()) {
    return type.types.some((constituent) => contributesBoolean(constituent, checker));
  }
  return false;
}

/**
 * `getBooleanType`/`isTypeAssignableTo` answer the polarity question exactly,
 * but neither is on the public TypeChecker surface. Both are feature-detected
 * so a TypeScript upgrade that drops them degrades to the structural fallback
 * in `canHoldBoolean` instead of crashing the gate.
 */
type AssignabilityProbe = {
  getBooleanType?: () => ts.Type;
  isTypeAssignableTo?: (source: ts.Type, target: ts.Type) => boolean;
};

function booleanAssignableTo(target: ts.Type, checker: ts.TypeChecker): boolean | undefined {
  const probe = checker as ts.TypeChecker & AssignabilityProbe;
  if (
    typeof probe.getBooleanType !== 'function' ||
    typeof probe.isTypeAssignableTo !== 'function'
  ) {
    return undefined;
  }
  return probe.isTypeAssignableTo(probe.getBooleanType(), target);
}

function propsSurfaceNamesIn(sourceFile: ts.SourceFile): ts.Identifier[] {
  const names: ts.Identifier[] = [];
  for (const statement of sourceFile.statements) {
    if (
      (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) &&
      isExported(statement) &&
      isComponentPropsSurfaceName(statement.name.text)
    ) {
      names.push(statement.name);
    }
  }
  return names;
}

function componentDeclarationSite(
  symbol: ts.Symbol,
): { sourceFile: ts.SourceFile; declaration: ts.Declaration } | undefined {
  for (const declaration of symbol.declarations ?? []) {
    const sourceFile = declaration.getSourceFile();
    const normalized = sourceFile.fileName.replace(/\\/g, '/');
    // Anything declared inside this package's src/ is ours to police —
    // including shared helper surfaces (src/utilities/dialog-props.ts, …)
    // that component Props intersect. node_modules declarations (inherited
    // HTMLAttributes members, svelte helpers) are not.
    if (normalized.includes('/src/') && !normalized.includes('/node_modules/')) {
      return { sourceFile, declaration };
    }
  }
  return undefined;
}

export function collectResolvedSurfaceViolations(
  program: ts.Program,
  typesFiles: readonly string[],
): PropConventionViolation[] {
  const checker = program.getTypeChecker();
  const violations = new Map<string, PropConventionViolation>();
  const typesFileSet = new Set(typesFiles.map((file) => resolve(file)));
  const concepts = new Map<string, { propName: string; filePath: string; line: number }>();

  const record = (violation: PropConventionViolation) => {
    violations.set(
      `${violation.filePath}:${violation.line}:${violation.propName}:${violation.message}`,
      violation,
    );
  };

  for (const sourceFile of program.getSourceFiles()) {
    if (!typesFileSet.has(resolve(sourceFile.fileName))) continue;

    for (const surfaceName of propsSurfaceNamesIn(sourceFile)) {
      const surfaceType = checker.getTypeAtLocation(surfaceName);
      const arms = surfaceType.isUnion() ? surfaceType.types : [surfaceType];
      for (const arm of arms) {
        for (const property of arm.getProperties()) {
          const propName = property.getName();
          const site = componentDeclarationSite(property);
          if (!site) continue;
          const filePath = relative(repositoryRoot, site.sourceFile.fileName);
          const line = lineFor(site.sourceFile, site.declaration.getStart(site.sourceFile));

          const bannedMessage = bannedNames.get(propName);
          if (bannedMessage) {
            record({ filePath, line, propName, message: bannedMessage });
          }

          const conceptKey = propConceptKey(propName);
          if (conceptKey) {
            const existing = concepts.get(conceptKey);
            if (existing && existing.propName !== propName) {
              record({
                filePath,
                line,
                propName,
                message:
                  `Duplicates the existing ${existing.propName} concept at ` +
                  `${existing.filePath}:${existing.line}; use one public name for one concept.`,
              });
            } else if (!existing) {
              concepts.set(conceptKey, { propName, filePath, line });
            }
          }

          if (booleanPrefixPattern.test(propName)) {
            const propertyType = checker.getTypeOfSymbolAtLocation(property, site.declaration);
            if (isBooleanLikePropType(propertyType, checker)) {
              record({
                filePath,
                line,
                propName,
                message:
                  'Boolean props must use adjective/state names, not show*/allow*/use* prefixes.',
              });
            }
          }

          if (/^on[a-z]/.test(propName)) {
            // Classified by signature, not by a name allowlist: ANY lowercase
            // on* prop is legitimate exactly when it is a native passthrough,
            // i.e. its first parameter extends Event.
            const propType = checker.getTypeOfSymbolAtLocation(property, site.declaration);
            if (!isNativePassthroughHandlerType(propType, checker)) {
              record({
                filePath,
                line,
                propName,
                message:
                  'Lowercase on* props are reserved for native DOM passthrough; this ' +
                  "handler's first parameter does not extend Event. Use a camelCase " +
                  'onNounVerb name (e.g. onValueChange).',
              });
            }
          }
        }
      }
    }
  }

  return [...violations.values()].toSorted((left, right) =>
    left.filePath === right.filePath
      ? left.line - right.line
      : left.filePath < right.filePath
        ? -1
        : 1,
  );
}

export function createPropsProgram(typesFiles: readonly string[]): ts.Program {
  const configPath = ts.findConfigFile(
    packageRoot,
    (fileName) => ts.sys.fileExists(fileName),
    'tsconfig.json',
  );
  if (!configPath) {
    throw new Error('check-prop-conventions: could not locate a tsconfig.json for the package.');
  }
  const parsed = ts.getParsedCommandLineOfConfigFile(configPath, undefined, {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
      throw new Error(
        `check-prop-conventions: tsconfig parse failed: ${ts.flattenDiagnosticMessageText(
          diagnostic.messageText,
          '\n',
        )}`,
      );
    },
  });
  if (!parsed) {
    throw new Error('check-prop-conventions: could not parse the package tsconfig.');
  }
  return ts.createProgram([...typesFiles], { ...parsed.options, noEmit: true });
}

// (No textual prefilter: a surface can inherit a native-named handler from an
// imported helper type without the exporting file ever matching a text
// pattern, so every *.types.ts file goes through the type-aware pass. The
// dominant cost is the one-time ts.Program bootstrap — lib.dom + svelte type
// resolution — not the per-file surface walk, so scanning all files costs
// roughly the same as scanning the prefiltered subset did.)

async function scan(): Promise<PropConventionViolation[]> {
  const glob = new Glob('src/components/**/*.types.ts');
  const violations = new Map<string, PropConventionViolation>();
  const record = (violation: PropConventionViolation) => {
    violations.set(
      `${violation.filePath}:${violation.line}:${violation.propName}:${violation.message}`,
      violation,
    );
  };

  const typeAwareCandidates: string[] = [];
  for await (const relativePath of glob.scan({ cwd: packageRoot })) {
    const absolutePath = resolve(packageRoot, relativePath);
    const source = await Bun.file(absolutePath).text();
    const filePath = relative(repositoryRoot, absolutePath);
    for (const violation of collectPropConventionViolations(source, filePath)) {
      record(violation);
    }
    typeAwareCandidates.push(absolutePath);
  }

  if (typeAwareCandidates.length > 0) {
    const program = createPropsProgram(typeAwareCandidates);
    for (const violation of collectResolvedSurfaceViolations(program, typeAwareCandidates)) {
      record(violation);
    }
  }

  return [...violations.values()].toSorted((left, right) =>
    left.filePath === right.filePath
      ? left.line - right.line
      : left.filePath < right.filePath
        ? -1
        : 1,
  );
}

// ---------------------------------------------------------------------------
// Component-name directory scan (docs/component-api-conventions.md,
// "*Group versus plural component names"). A curated collection is named
// `<Singular>Group`;
// a bare plural is legal only as a domain mass noun that composes no matching
// singular component. This is a NEW capability, distinct from `bannedNames`
// above: that map bans PROP names, this scans COMPONENT directory names.
// ---------------------------------------------------------------------------

/**
 * Whether a directory is a real, directory-shaped component: mirrors
 * `discover-component-directories.ts`'s canonical predicate (which
 * `check-component-inventory.ts` and the artifact/schema/manifest generators
 * all rely on) rather than inventing a second definition of "is a component".
 * A directory qualifies only when it contains BOTH `<name>.svelte` and
 * `<name>.types.ts` — the marker that the per-directory migration is
 * complete — which keeps support directories (`_radio`, `icons`, an
 * in-progress scaffold with only some files written) out of the scan so they
 * cannot produce a false-positive shadow match.
 */
function isComponentDirectory(directory: string, name: string): boolean {
  if (name.startsWith('_')) return false;
  return (
    existsSync(join(directory, `${name}.svelte`)) && existsSync(join(directory, `${name}.types.ts`))
  );
}

/**
 * Existing component directory names (kebab-case), e.g. `avatar`,
 * `avatar-group`, `statistic`, `statistic-group`. Descends one level into
 * `experimental/` so an experimental singular still shadows a proposed
 * top-level plural. Only directories that pass `isComponentDirectory` count,
 * matching what `discoverComponentDirectories()` would enumerate. Used to
 * catch a NEW component name that is a bare plural of an existing singular
 * component instead of `<Singular>Group`.
 */
export function existingComponentDirectoryNames(root: string = componentsDirectory): Set<string> {
  const names = new Set<string>();
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    if (entry.name === 'icons') continue;
    if (entry.name === 'experimental') {
      const experimentalRoot = join(root, entry.name);
      for (const nested of readdirSync(experimentalRoot, { withFileTypes: true })) {
        if (!nested.isDirectory() || nested.name.startsWith('.')) continue;
        const nestedDirectory = join(experimentalRoot, nested.name);
        if (isComponentDirectory(nestedDirectory, nested.name)) names.add(nested.name);
      }
      continue;
    }
    const directory = join(root, entry.name);
    if (isComponentDirectory(directory, entry.name)) names.add(entry.name);
  }
  return names;
}

export type ComponentNameShadowViolation = {
  candidateName: string;
  shadowedComponent: string;
  message: string;
};

/**
 * A stem ending in x/ch/sh/s/z takes `-es` for its regular plural
 * (`checkbox` → `checkboxes`) or `-ies` for consonant-plus-`y` singulars
 * (`feed-boundary` → `feed-boundaries`), rather than a bare trailing `s`. These are the
 * TWO additional regular-plural shapes handled beyond the plain trailing-`s`
 * strip — still no irregular plurals (`child`/`children`, `datum`/`data`,
 * …), which stay out of scope.
 */
const ES_PLURAL_STEM_ENDING = /(?:x|ch|sh|s|z)$/;

/**
 * Candidate singular forms to check, in order: the regular `-es` strip when
 * the remaining stem is one that takes `-es` (`checkboxes` → `checkbox`),
 * then the plain trailing-`s` strip (`avatars` → `avatar`). Returns at most
 * three candidates and never the same string twice. Order: the `-ies` → `y`
 * restoration first, then the `-es` strip (x/ch/sh/s/z stems), then the plain
 * trailing-`s` strip.
 */
function candidateSingulars(candidateName: string): string[] {
  const candidates: string[] = [];
  if (candidateName.endsWith('ies')) {
    const iesStem = `${candidateName.slice(0, -3)}y`;
    candidates.push(iesStem);
  }
  if (candidateName.endsWith('es')) {
    const esStem = candidateName.slice(0, -2);
    if (ES_PLURAL_STEM_ENDING.test(esStem) && !candidates.includes(esStem)) candidates.push(esStem);
  }
  if (candidateName.endsWith('s')) {
    const sStem = candidateName.slice(0, -1);
    if (!candidates.includes(sStem)) candidates.push(sStem);
  }
  return candidates;
}

/**
 * Checks a candidate NEW component's kebab-case directory name against the
 * existing component directory set. Strips only a trailing `s`, or `-es`
 * when the remaining stem takes the regular `-es` plural (x/ch/sh/s/z) — no
 * irregular-plural handling beyond that — and rejects the candidate when
 * what remains is itself an existing singular component: that shape is a
 * collection name and must be `<singular>-group` (or whatever grouping
 * contract the family's `@purpose` documents), never a bare plural.
 */
export function checkComponentNameForBarePluralShadow(
  candidateName: string,
  existingNames: ReadonlySet<string>,
): ComponentNameShadowViolation | undefined {
  for (const singular of candidateSingulars(candidateName)) {
    if (!existingNames.has(singular)) continue;
    return {
      candidateName,
      shadowedComponent: singular,
      message:
        `Component name "${candidateName}" is a bare plural of the existing "${singular}" ` +
        `component. A curated collection of "${singular}" instances must be named ` +
        `"${singular}-group" (see ${documentationPath}, "*Group versus plural component ` +
        'names"), not a bare plural.',
    };
  }
  return undefined;
}

/**
 * Bare-plural component directory names that predate the *Group-vs-plural
 * convention (docs/component-api-conventions.md, "*Group versus plural
 * component names") and are deliberately NOT renamed. `tabs` collects `Tab`
 * (via the `Tabs.Trigger` namespace) and is a genuine collection whose bare
 * plural shipped before the rule existed — grandfathered rather than flagged.
 * Add a new name here only with an explicit, reviewed exception; the default
 * for every future component is the shadow check below, with no allowlist.
 */
const GRANDFATHERED_COMPONENT_NAMES = new Set<string>(['tabs']);

/**
 * Scans every existing component directory name against every OTHER existing
 * directory name, so a newly added bare-plural directory that shadows an
 * existing singular component fails `check:prop-conventions` (and therefore
 * `lint:invariants`) immediately — not only when a future new-component
 * candidate is checked by hand.
 */
export function collectComponentNameShadowViolations(
  existingNames: ReadonlySet<string> = existingComponentDirectoryNames(),
): ComponentNameShadowViolation[] {
  const violations: ComponentNameShadowViolation[] = [];
  for (const name of existingNames) {
    if (GRANDFATHERED_COMPONENT_NAMES.has(name)) continue;
    // No self-exclusion needed: every derived singular (trailing-`s`, `-es`,
    // or `-ies`→`y` strip) differs from the original name — the first two are
    // strictly shorter and the `-ies` form swaps its suffix — so
    // `existingNames.has(singular)` can only ever match some OTHER entry.
    const violation = checkComponentNameForBarePluralShadow(name, existingNames);
    if (violation) violations.push(violation);
  }
  return violations;
}

async function main() {
  const violations = await scan();
  const componentNameViolations = collectComponentNameShadowViolations();

  if (violations.length > 0 || componentNameViolations.length > 0) {
    const sections = [
      ...(violations.length > 0
        ? [
            `check-prop-conventions — prop API vocabulary violations. See ${documentationPath}.`,
            ...violations.map(
              (violation) =>
                `${violation.filePath}:${violation.line}: ${violation.propName}: ${violation.message}`,
            ),
          ]
        : []),
      ...(componentNameViolations.length > 0
        ? [
            `check-prop-conventions — component-name violations. See ${documentationPath}.`,
            ...componentNameViolations.map((violation) => violation.message),
          ]
        : []),
    ];
    console.error(sections.join('\n'));
    process.exit(1);
  }

  console.log('check-prop-conventions — OK.');
}

if (import.meta.main) {
  await main();
}
