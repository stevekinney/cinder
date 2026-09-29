/**
 * Drives one real MCP `initialize` handshake against `POST {origin}/mcp`
 * (plan §9.7 T7.3: "interactive 'Test MCP session' panel showing full
 * headers/body incl. Mcp-Session-Id/Mcp-Session-Token flow"). Verified wire
 * contract against `weft/src/mcp/http.ts` v0.11.0: an `initialize` request
 * with no `Mcp-Session-Id` header creates a new session, and the response
 * carries `Mcp-Session-Id` + `Mcp-Session-Token` (the token disclosed only
 * on this first response — see that module's `maybeSessionHeaders` doc for
 * why: "the token is disclosed only here, so a leaked id alone cannot
 * continue another caller's anonymous session").
 *
 * A scoped `fetch()`, not `HttpClient`, for the same reason as
 * `discovery-client.ts`: `/mcp` is outside `HttpClient`'s modeled surface.
 */
import type { HttpClient } from '@lostgradient/weft';

import { discoveryOrigin } from './discovery-client.ts';

export interface McpTestSessionRequest {
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: unknown;
}

export interface McpTestSessionResponse {
  readonly status: number;
  readonly statusText: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: unknown;
}

export interface McpTestSessionResult {
  readonly request: McpTestSessionRequest;
  readonly response: McpTestSessionResponse;
}

const MCP_PROTOCOL_VERSION_FOR_TEST = '2025-03-26';

function buildInitializeBody(): unknown {
  return {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: MCP_PROTOCOL_VERSION_FOR_TEST,
      capabilities: {},
      clientInfo: { name: 'weft-ui', version: '0.1.0' },
    },
  };
}

function headersToRecord(headers: Headers): Record<string, string> {
  return Object.fromEntries(headers.entries());
}

/**
 * Sends one `initialize` request and returns the full request/response
 * shape for display — never throws on a non-2xx status (that's a valid,
 * displayable outcome for this panel, e.g. a 403 from a stale/mismatched
 * token would be the exact scenario the panel documents). Only a genuine
 * transport failure (network error, DNS failure) rejects.
 */
export async function testMcpSession(
  client: Pick<HttpClient, 'baseUrl' | 'headers'>,
): Promise<McpTestSessionResult> {
  const url = `${discoveryOrigin(client)}/mcp`;
  const requestHeaders: Record<string, string> = {
    ...client.headers,
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
  };
  const body = buildInitializeBody();

  const response = await fetch(url, {
    method: 'POST',
    headers: requestHeaders,
    body: JSON.stringify(body),
  });

  const contentType = response.headers.get('content-type') ?? '';
  const responseBody = contentType.includes('json')
    ? await response.json().catch(() => null)
    : await response.text();

  return {
    request: { url, headers: requestHeaders, body },
    response: {
      status: response.status,
      statusText: response.statusText,
      headers: headersToRecord(response.headers),
      body: responseBody,
    },
  };
}
