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

function terminalTierReference(
  reference: string,
  depth: number,
  mixed: boolean,
  alias: string | undefined,
): TierReference[] {
  return [{ tier: reference, depth, isMix: mixed, ...(alias ? { alias } : {}) }];
}

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

  function currentColorReference(
    depth: number,
    mixed: boolean,
    alias: string | undefined,
  ): TierReference | undefined {
    const currentColor = options.currentColor?.();
    if (currentColor === undefined) return undefined;

    const reference = {
      tier: currentColor.tier,
      depth: depth + currentColor.depth,
      isMix: mixed || currentColor.isMix,
    };
    const resolvedAlias = alias ?? currentColor.alias;
    return resolvedAlias === undefined ? reference : { ...reference, alias: resolvedAlias };
  }

  function resolveVarFunction(
    node: Extract<valueParser.Node, { type: 'function' }>,
    level: number,
    depth: number,
    mixed: boolean,
    alias: string | undefined,
  ): TierReference[] | undefined {
    const comma = node.nodes.findIndex((item) => item.type === 'div' && item.value === ',');
    const reference = variableReference(node);
    if (reference === undefined) return undefined;

    const variable = lookup(reference, level);
    const invalid = variable?.value.trim().toLowerCase() === 'initial';
    if (tierName.test(reference) && !invalid) {
      return terminalTierReference(reference, depth, mixed, alias);
    }

    if (variable && !invalid && !cyclic(reference, level)) {
      return visit(
        valueParser(variable.value).nodes,
        variable.level,
        depth + 1,
        mixed,
        alias ?? reference,
      );
    }

    return comma >= 0 ? visit(node.nodes.slice(comma + 1), level, depth, mixed, alias) : undefined;
  }

  function visitFunction(
    node: Extract<valueParser.Node, { type: 'function' }>,
    level: number,
    depth: number,
    mixed: boolean,
    alias: string | undefined,
  ): TierReference[] | undefined {
    const name = node.value.toLowerCase();
    return name === 'var'
      ? resolveVarFunction(node, level, depth, mixed, alias)
      : visit(node.nodes, level, depth, mixed || name === 'color-mix', alias);
  }

  function visitNode(
    node: valueParser.Node,
    level: number,
    depth: number,
    mixed: boolean,
    alias: string | undefined,
  ): TierReference[] | undefined {
    if ('unclosed' in node && node.unclosed) return undefined;
    if (node.type === 'word' && node.value.toLowerCase() === 'currentcolor') {
      const reference = currentColorReference(depth, mixed, alias);
      return reference === undefined ? [] : [reference];
    }
    if (node.type !== 'function') return [];
    return visitFunction(node, level, depth, mixed, alias);
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
      const resolved = visitNode(node, level, depth, mixed, alias);
      if (resolved === undefined) return undefined;
      references.push(...resolved);
    }
    return references;
  }

  return visit(valueParser(value).nodes, minimumLevel, 0, false) ?? [];
}
