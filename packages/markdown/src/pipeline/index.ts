/**
 * Markdown Pipeline - Public API
 *
 * DEP-35: Markdown dialect + deterministic serialization pipeline
 *
 * This module provides a complete Markdown processing pipeline with:
 * - CommonMark + GFM parsing (tables, task lists, strikethrough)
 * - Deterministic serialization with consistent formatting
 * - AST utilities for comparison and validation
 *
 * @example
 * ```ts
 * import { parse, serialize, roundTrip } from '$lib/document/pipeline';
 *
 * // Parse Markdown to AST
 * const result = parse('# Hello *world*');
 * if (result.success) {
 *   // Serialize AST back to Markdown
 *   const markdown = serialize(result.ast);
 *
 *   // Test round-trip fidelity
 *   const trip = roundTrip('# Hello');
 *   console.log(trip.passes); // true
 * }
 * ```
 *
 * @module
 */

// Core parsing functions
export { parse, parseOrThrow } from './parser.js';

// Serialization
export { serialize, serializerOptions } from './serializer.js';

// AST utilities
export {
  astEquals,
  clearNormalizeCache,
  contentEquals,
  contentEqualsWithFrontMatter,
  diffAsts,
  normalize,
  normalizeWithCache,
  // Front matter extensions (DEP-61)
  normalizeWithFrontMatter,
  roundTrip,
  roundTripWithFrontMatter,
  stripPositions,
  validatePositions,
} from './ast.js';
export type { RoundTripResult, RoundTripWithFrontMatterResult } from './ast.js';

// Types
export type {
  Blockquote,
  Break,
  Code,
  Content,
  Delete,
  Emphasis,
  Heading,
  Html,
  Image,
  InlineCode,
  Link,
  List,
  ListItem,
  Paragraph,
  ParseFailure,
  // Custom types
  ParseOptions,
  ParseResult,
  ParseSuccess,
  Position,
  // mdast types
  Root,
  SerializeOptions,
  Strong,
  Table,
  TableCell,
  TableRow,
  Text,
  ThematicBreak,
} from './types.js';

// Error classes
export { MarkdownParseError, PositionValidationError } from './errors.js';

// Front matter (DEP-61)
export {
  extractFrontMatter,
  getFrontMatterBlock,
  hasFrontMatter,
  mergeFrontMatter,
  parseFrontMatter,
  serializeYaml,
  stringifyFrontMatter,
  validateFrontMatter,
} from './frontmatter.js';

export type {
  DocumentWithFrontMatter,
  FrontMatterParseResult,
  FrontMatterSerializeOptions,
} from './types.js';

export type { FrontMatterBlock } from './frontmatter.js';
