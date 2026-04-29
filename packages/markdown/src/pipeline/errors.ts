/**
 * Custom error classes for the Markdown pipeline.
 *
 * DEP-35: Markdown dialect + deterministic serialization pipeline
 *
 * @module
 */

/**
 * Error thrown when Markdown parsing fails.
 *
 * Note: remark-parse is very lenient and rarely throws. Most malformed
 * Markdown is parsed as paragraph text. This error is mainly for edge
 * cases like null/undefined input or internal errors.
 */
export class MarkdownParseError extends Error {
  override readonly name = 'MarkdownParseError';

  /**
   * The input that failed to parse (truncated for large inputs).
   */
  readonly input: string;

  constructor(message: string, input: string) {
    super(message);
    // Truncate input if too large for error message
    this.input = input.length > 200 ? `${input.slice(0, 200)}...` : input;

    // Maintain proper prototype chain
    Object.setPrototypeOf(this, MarkdownParseError.prototype);
  }
}

/**
 * Error thrown when position validation fails.
 *
 * This indicates that some AST nodes are missing position data,
 * which breaks downstream features like comment anchoring (DEP-39)
 * and diff computation (DEP-42).
 */
export class PositionValidationError extends Error {
  override readonly name = 'PositionValidationError';

  /**
   * List of node types that are missing position data.
   */
  readonly missingPositions: string[];

  constructor(missingPositions: string[]) {
    super(
      `AST nodes missing position data: ${missingPositions.join(', ')}. ` +
        `Position data is required for comment anchoring and diff computation.`,
    );
    this.missingPositions = missingPositions;

    // Maintain proper prototype chain
    Object.setPrototypeOf(this, PositionValidationError.prototype);
  }
}
