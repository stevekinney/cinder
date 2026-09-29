import { JSON_SCHEMA, load } from 'js-yaml';
import { sortKeys as sortObjectKeys } from '../utilities/sort-keys.js';
import type { FrontMatterSerializeOptions } from './types.js';

type YamlSerializeOptions = Pick<FrontMatterSerializeOptions, 'sortKeys'>;

type ListenerNode = {
  children: ListenerNode[];
  kind?: string | null;
  result?: unknown;
};

const sortedKeyOptions: YamlSerializeOptions = { sortKeys: true };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
/**
 * Serialize front matter and body back to a complete Markdown document.
 *
 * @param data - Front matter data to serialize (null or empty object = no front matter)
 * @param body - Markdown body content
 * @param options - Serialization options
 * @returns Complete Markdown document with front matter (if data is non-empty)
 *
 * @example
 * ```ts
 * // With front matter
 * const doc = stringifyFrontMatter({ title: 'Hello' }, '# Content');
 * // => '---\ntitle: Hello\n---\n\n# Content'
 *
 * // Without front matter
 * const docNoMeta = stringifyFrontMatter(null, '# Content');
 * // => '# Content'
 * ```
 */
export function stringifyFrontMatter(
  data: Record<string, unknown> | null,
  body: string,
  options: FrontMatterSerializeOptions = {},
): string {
  const {
    preserveRaw = true,
    originalRaw,
    originalData,
    preserveEmptyFrontMatter = false,
    sortKeys = true,
  } = options;

  // If no data, handle based on preserveEmptyFrontMatter option
  if (!data || Object.keys(data).length === 0) {
    if (preserveEmptyFrontMatter) {
      // Preserve empty front matter block for documents that originally had it
      return `---\n---\n${body}`;
    }
    return body;
  }

  // Determine if we can preserve the original raw YAML
  let yamlContent: string;

  if (canPreserveRaw(preserveRaw, originalRaw, originalData, data)) {
    // Data unchanged, preserve original formatting
    yamlContent = originalRaw;
  } else {
    // Generate new YAML. Deterministic top-level key ordering remains the
    // default; edit flows can opt into the parsed mapping's insertion order.
    const keyOrder =
      !sortKeys && originalRaw ? recoverTopLevelKeyOrder(originalRaw, originalData) : undefined;
    const keys = getOrderedKeys(data, { sortKeys }, keyOrder);

    yamlContent = serializeYamlWithOrderedKeys(data, keys);
  }

  // Combine front matter and body
  // The closing delimiter needs its own line ending, then body follows
  // This preserves blank lines between front matter and content
  return `---\n${yamlContent}\n---\n${body}`;
}

function canPreserveRaw(
  preserveRaw: boolean,
  originalRaw: string | null | undefined,
  originalData: Record<string, unknown> | null | undefined,
  data: Record<string, unknown>,
): originalRaw is string {
  return Boolean(preserveRaw && originalRaw && originalData && dataEquals(data, originalData));
}

/**
 * Serialize data to YAML.
 * Top-level keys are sorted alphabetically by default for consistent output.
 * Nested object keys keep the serializer's existing sorted behavior.
 *
 * @param data - The data object to serialize
 * @returns The YAML string (without delimiters)
 *
 * @example
 * ```ts
 * const yaml = serializeYaml({ title: 'Hello', tags: ['a', 'b'] });
 * // "tags: [a, b]\ntitle: Hello"
 * ```
 */
export function serializeYaml(
  data: Record<string, unknown>,
  options: YamlSerializeOptions = {},
): string {
  const keys = getOrderedKeys(data, options);
  return serializeYamlWithOrderedKeys(data, keys);
}

function serializeYamlWithOrderedKeys(data: Record<string, unknown>, keys: string[]): string {
  const lines: string[] = [];
  for (const key of keys) {
    const value = data[key];
    lines.push(formatYamlLine(key, value));
  }

  return lines.join('\n');
}

/**
 * Format a single YAML key-value pair.
 * Handles common value types with appropriate formatting.
 */
function formatYamlLine(key: string, value: unknown): string {
  const yamlKey = formatYamlKey(key);

  if (value === null || value === undefined) {
    return `${yamlKey}: null`;
  }

  if (typeof value === 'boolean' || typeof value === 'number') {
    return `${yamlKey}: ${value}`;
  }

  if (typeof value === 'string') {
    // Use quotes for strings that contain special characters or look like other types
    if (needsQuoting(value)) {
      return `${yamlKey}: "${escapeString(value)}"`;
    }
    return `${yamlKey}: ${value}`;
  }

  if (Array.isArray(value)) {
    const formatted = formatYamlArray(value);
    return `${yamlKey}:${formatted.startsWith('\n') ? formatted : ` ${formatted}`}`;
  }
  if (isRecord(value)) return `${yamlKey}:${formatYamlValue(value)}`;
  return `${yamlKey}: ${formatValue(value)}`;
}

function formatYamlValue(value: unknown): string {
  if (Array.isArray(value)) return formatYamlArray(value);
  if (isRecord(value)) return `\n${serializeNestedObject(value, 2)}`;
  return formatValue(value);
}

function formatYamlArray(value: unknown[]): string {
  if (value.length === 0) return '[]';
  if (value.every((item) => typeof item === 'string' && !needsQuoting(item))) {
    return `[${value.join(', ')}]`;
  }
  return `\n${value.map((item) => `  - ${formatValue(item)}`).join('\n')}`;
}

/**
 * Serialize a nested object with indentation.
 */
function serializeNestedObject(obj: Record<string, unknown>, indent: number): string {
  const spaces = ' '.repeat(indent);
  const lines: string[] = [];
  const keys = getOrderedKeys(obj, sortedKeyOptions);

  for (const key of keys) {
    const value = obj[key];
    const yamlKey = formatYamlKey(key);
    if (isRecord(value)) {
      lines.push(`${spaces}${yamlKey}:`);
      lines.push(serializeNestedObject(value, indent + 2));
    } else {
      lines.push(`${spaces}${yamlKey}: ${formatValue(value)}`);
    }
  }

  return lines.join('\n');
}

/**
 * Format a value for inline use in YAML.
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null';
  }
  if (typeof value === 'boolean' || typeof value === 'number') {
    return String(value);
  }
  if (typeof value === 'string') {
    if (needsQuoting(value)) {
      return `"${escapeString(value)}"`;
    }
    return value;
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => formatValue(item)).join(', ')}]`;
  }
  if (isRecord(value)) {
    // Serialize objects in YAML flow style: {key: value, key2: value2}
    const pairs = getOrderedKeys(value, sortedKeyOptions).map(
      (key) => `${formatYamlKey(key)}: ${formatValue(value[key])}`,
    );
    return `{${pairs.join(', ')}}`;
  }

  return JSON.stringify(value) ?? 'null';
}

function getOrderedKeys(
  data: Record<string, unknown>,
  options: YamlSerializeOptions,
  keyOrder?: string[],
): string[] {
  const keys = Object.keys(data);
  if (options.sortKeys === false && keyOrder) {
    const seenKeys = new Set<string>();
    const orderedKeys = keyOrder.filter((key) => {
      if (!Object.hasOwn(data, key) || seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    });

    orderedKeys.push(
      ...keys.filter((key) => {
        if (seenKeys.has(key)) return false;
        seenKeys.add(key);
        return true;
      }),
    );

    return orderedKeys;
  }
  return options.sortKeys === false ? keys : keys.toSorted();
}

function recoverTopLevelKeyOrder(
  raw: string,
  originalData: Record<string, unknown> | null | undefined,
): string[] | undefined {
  const stack: ListenerNode[] = [];
  const completed: ListenerNode[] = [];

  try {
    const loaded = load(raw, {
      schema: JSON_SCHEMA,
      listener(_event, state) {
        if (_event === 'open') {
          stack.push({ children: [] });
          return;
        }

        const node = stack.pop() ?? { children: [] };
        node.kind = state.kind;
        node.result = state.result;
        completed.push(node);
        stack.at(-1)?.children.push(node);
      },
    });

    if (!isRecord(loaded) || !originalData || !dataEquals(loaded, originalData)) return undefined;

    const rootMapping = [...completed, ...stack]
      .filter((node) => node.kind === 'mapping' && node.result === loaded)
      .toSorted((left, right) => right.children.length - left.children.length)[0];

    return rootMapping?.children
      .filter((_, index) => index % 2 === 0)
      .map((node) => String(node.result));
  } catch {
    return undefined;
  }
}

function formatYamlKey(key: string): string {
  return needsQuoting(key) ? `"${escapeString(key)}"` : key;
}

/**
 * Check if a string value needs quoting in YAML.
 */
function needsQuoting(value: string): boolean {
  // Empty string
  if (value === '') return true;

  // Looks like a number or boolean
  if (/^[-+]?\d*\.?\d+$/.test(value)) return true;
  if (['true', 'false', 'yes', 'no', 'on', 'off', 'null'].includes(value.toLowerCase()))
    return true;

  // Contains special characters
  if (/[:#[\]{}|>&*!?,\\"]/.test(value)) return true;

  // Starts with special characters
  if (/^[@`']/.test(value)) return true;

  // Contains newlines
  if (value.includes('\n')) return true;

  return false;
}

/**
 * Escape special characters in a string for YAML double-quoted strings.
 */
function escapeString(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

/**
 * Deep equality check for front matter data.
 * Used to determine if original raw YAML can be preserved.
 */
function dataEquals(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  return JSON.stringify(sortObjectKeys(a)) === JSON.stringify(sortObjectKeys(b));
}
