/**
 * Mention extraction utility for comment bodies.
 *
 * Extracts @username mentions while avoiding false positives from:
 * - Email addresses (user@example.com)
 * - Code blocks (```code```)
 * - Inline code (`code`)
 *
 * ## Known Limitations
 *
 * This is a regex-based heuristic, not a full Markdown parser. Edge cases:
 * - **Unterminated fenced blocks**: An unclosed ``` consumes the rest of the string
 * - **Escaped backticks**: Inline code with escaped backticks (e.g., `foo\`bar`) may misbehave
 * - **HTML code tags**: `<code>@mention</code>` is not detected as code
 *
 * For most comment use cases, these limitations are acceptable. If more robust
 * parsing is needed, consider using the editor's AST via Milkdown/Prosemirror.
 *
 * @module
 */

// Match @username but not email addresses (preceded by word char, period, or plus)
// Uses a capturing group alternative instead of negative lookbehind for Safari <16.4 compatibility
// Pattern: (start-of-string OR non-email-char) followed by @username
// The username is in capture group 2
// Hoisted outside function to avoid regex recompilation on each call
const mentionRegex = /(^|[^.\w+])@([\w-]+)/g;

/**
 * Extract @mentions from a comment body.
 *
 * Matches @username patterns where username contains alphanumeric characters,
 * underscores, and hyphens. Ignores mentions inside code blocks and inline code,
 * and avoids matching email addresses.
 *
 * @param body - The comment body (Markdown)
 * @returns Array of unique usernames (without the @ prefix)
 *
 * @example
 * extractMentions('Hello @alice and @bob!')
 * // Returns: ['alice', 'bob']
 *
 * @example
 * extractMentions('Email: user@example.com @alice')
 * // Returns: ['alice'] (ignores email)
 *
 * @example
 * extractMentions('See `@config` or @alice')
 * // Returns: ['alice'] (ignores inline code)
 */
export function extractMentions(body: string): string[] {
  // Remove fenced code blocks (```...```)
  const withoutFencedCode = body.replace(/```[\s\S]*?```/g, '');

  // Remove inline code (`...`)
  const withoutCode = withoutFencedCode.replace(/`[^`]*`/g, '');

  // Reset regex lastIndex since we're reusing a global regex
  mentionRegex.lastIndex = 0;

  const mentions = new Set<string>();

  for (const match of withoutCode.matchAll(mentionRegex)) {
    // Group 2 contains the username (group 1 is the preceding character/start-of-string)
    const username = match[2];
    if (username) {
      mentions.add(username);
    }
  }

  return Array.from(mentions);
}
