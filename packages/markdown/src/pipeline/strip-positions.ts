/**
 * AST position stripping utility.
 *
 * Extracted to a separate module to avoid circular dependency
 * between ast.ts and parser.ts.
 *
 * @module
 */

import type { Nodes, Root } from 'mdast';
import { visit } from 'unist-util-visit';

/**
 * Remove position data from an AST for comparison purposes.
 *
 * Creates a deep clone of the AST with all `position` properties removed.
 * This is used for AST comparison (ignoring source positions) and when
 * parsing with `positions: false`.
 *
 * @param ast - The AST to strip positions from
 * @returns A new AST with positions removed
 */
export function stripPositions(ast: Root): Root {
  const clone = structuredClone(ast);
  visit(clone, (node: Nodes) => {
    // Every mdast node carries an optional `position`; deleting it is the
    // documented way to compare ASTs independent of source offsets.
    delete node.position;
  });
  return clone;
}
