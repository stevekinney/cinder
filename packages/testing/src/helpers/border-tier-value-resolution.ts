import valueParser from 'postcss-value-parser';

export type VariableValue = { readonly value: string; readonly level: number };
export type TierReference = {
  readonly tier: string;
  readonly depth: number;
  readonly isMix: boolean;
  readonly alias?: string;
};

type Lookup = (name: string, minimumLevel: number) => VariableValue | undefined;
type ResolutionOptions = {
  /** Resolves literal currentColor in the context of the property being audited. */
  readonly currentColor?: () => TierReference | undefined;
};
const tierName = /^--cinder-border(?:-muted|-strong)?$/;

/** The audit follows unescaped custom-property names; unsupported syntax fails closed. */
function variableReference(
  node: Extract<valueParser.Node, { type: 'function' }>,
): string | undefined {
  if (node.unclosed) return undefined;
  const comma = node.nodes.findIndex((item) => item.type === 'div' && item.value === ',');
  const primary = (comma < 0 ? node.nodes : node.nodes.slice(0, comma)).filter(
    (item) => item.type !== 'space' && item.type !== 'comment',
  );
  const reference =
    primary.length === 1 && primary[0]?.type === 'word' ? primary[0].value : undefined;
  return reference !== undefined && /^--[-_a-zA-Z0-9\u0080-\uFFFF]+$/.test(reference)
    ? reference
    : undefined;
}

/** Resolve var() reachability without flattening unused fallbacks into sibling references. */
export function resolveTierReferences(
  value: string,
  lookup: Lookup,
  minimumLevel = 0,
  options: ResolutionOptions = {},
): TierReference[] {
  const cycleCache = new Map<string, boolean>();

  // CSS dependency cycles include references in unused fallbacks. A fallback
  // inside a cyclic variable cannot make that variable valid again.
  function cyclic(name: string, level: number): boolean {
    const variable = lookup(name, level);
    if (!variable || tierName.test(name)) return false;
    const target = `${variable.level}:${name}`;
    const cached = cycleCache.get(target);
    if (cached !== undefined) return cached;
    const visited = new Set<string>();
    function reachesTarget(current: VariableValue): boolean {
      let found = false;
      valueParser(current.value).walk((node) => {
        if (node.type !== 'function' || node.value.toLowerCase() !== 'var') return;
        const reference = variableReference(node);
        if (!reference || tierName.test(reference)) return;
        const dependency = lookup(reference, current.level);
        if (!dependency) return;
        const key = `${dependency.level}:${reference}`;
        if (key === target) found = true;
        else if (!visited.has(key)) {
          visited.add(key);
          if (reachesTarget(dependency)) found = true;
        }
      });
      return found;
    }
    const found = reachesTarget(variable);
    cycleCache.set(target, found);
    return found;
  }

  function visit(
    nodes: readonly valueParser.Node[],
    level: number,
    depth: number,
    mixed: boolean,
    alias?: string,
  ): TierReference[] | undefined {
    const references: TierReference[] = [];
    for (const node of nodes) {
      if ('unclosed' in node && node.unclosed) return undefined;
      if (node.type === 'word' && node.value.toLowerCase() === 'currentcolor') {
        const currentColor = options.currentColor?.();
        if (currentColor !== undefined) {
          const reference = {
            tier: currentColor.tier,
            depth: depth + currentColor.depth,
            isMix: mixed || currentColor.isMix,
          };
          const resolvedAlias = alias ?? currentColor.alias;
          references.push(
            resolvedAlias === undefined ? reference : { ...reference, alias: resolvedAlias },
          );
        }
        continue;
      }
      if (node.type !== 'function') continue;
      const name = node.value.toLowerCase();
      if (name !== 'var') {
        const nested = visit(node.nodes, level, depth, mixed || name === 'color-mix', alias);
        if (!nested) return undefined;
        references.push(...nested);
        continue;
      }
      const comma = node.nodes.findIndex((item) => item.type === 'div' && item.value === ',');
      const reference = variableReference(node);
      if (reference === undefined) return undefined;
      const variable = lookup(reference, level);
      const invalid = variable?.value.trim().toLowerCase() === 'initial';
      let resolved: TierReference[] | undefined;
      // The three library tiers are terminal ink tokens supplied by the base
      // stylesheet. Keep their identity instead of substituting their color.
      if (tierName.test(reference) && !invalid) {
        resolved = [{ tier: reference, depth, isMix: mixed, ...(alias ? { alias } : {}) }];
      } else if (variable && !invalid && !cyclic(reference, level)) {
        resolved = visit(
          valueParser(variable.value).nodes,
          variable.level,
          depth + 1,
          mixed,
          alias ?? reference,
        );
      }
      if (resolved === undefined && comma >= 0) {
        resolved = visit(node.nodes.slice(comma + 1), level, depth, mixed, alias);
      }
      if (resolved === undefined) return undefined;
      references.push(...resolved);
    }
    return references;
  }

  return visit(valueParser(value).nodes, minimumLevel, 0, false) ?? [];
}
