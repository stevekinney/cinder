import { CinderKnowledgeError } from '@lostgradient/cinder/knowledge';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';

/** JSON-safe `{ code, message, suggestions }` shape for both tool and resource error payloads. */
export function errorPayload(error: unknown): {
  code: string;
  message: string;
  suggestions: string[];
} {
  return {
    code: error instanceof CinderKnowledgeError ? error.code : 'UNEXPECTED_ERROR',
    message: error instanceof Error ? error.message : String(error),
    suggestions: error instanceof CinderKnowledgeError ? error.suggestions : [],
  };
}

/** Wrap a thrown error as an MCP tool result with `isError: true`. */
export function toolError(error: unknown): {
  isError: true;
  content: Array<{ type: 'text'; text: string }>;
  structuredContent: { error: ReturnType<typeof errorPayload> };
} {
  const payload = errorPayload(error);
  return {
    isError: true,
    content: [{ type: 'text' as const, text: payload.message }],
    structuredContent: { error: payload },
  };
}

/** Translate a thrown error into the MCP protocol error a resource read must throw. */
export function resourceError(error: unknown): never {
  const payload = errorPayload(error);
  const protocolCode =
    error instanceof CinderKnowledgeError ? ErrorCode.InvalidParams : ErrorCode.InternalError;
  throw new McpError(protocolCode, payload.message, { error: payload });
}
