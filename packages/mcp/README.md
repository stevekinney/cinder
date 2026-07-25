# @lostgradient/cinder-mcp

A [Model Context Protocol](https://modelcontextprotocol.io/introduction) server exposing [Cinder](https://github.com/stevekinney/cinder) component discovery, comparison, and best-practice guidance to MCP clients — Claude Code, Codex, GitHub Copilot, and any other MCP-compatible agent.

It is read-only: every tool, resource, and prompt below reads Cinder's generated component manifest and metadata. Nothing it exposes writes to your project.

## Install

```sh
npm install --save-dev @lostgradient/cinder-mcp
```

Installing this package pulls in `@lostgradient/cinder`, the `@modelcontextprotocol/sdk`, and `zod` as regular dependencies — nothing else to install, and installing `@lostgradient/cinder` on its own never pulls in the MCP SDK or `zod`.

## Requirements

- Node.js >= 18. The published `cinder-mcp` binary is Node-only — no Bun installation is required to run it.

## Launch

Every client below should invoke the installed binary the same way:

```sh
npx --no-install cinder-mcp
```

`--no-install` resolves the binary already installed in your project's `node_modules/.bin` — it never reaches out to the npm registry at invocation time.

## Client configuration

Verified against each client's current documentation as of this package's initial release. If a client changes its schema, prefer that client's own docs over this file.

### Claude Code — `.mcp.json`

```json
{
  "mcpServers": {
    "cinder": {
      "command": "npx",
      "args": ["--no-install", "cinder-mcp"]
    }
  }
}
```

Source: [Claude Code MCP docs](https://code.claude.com/docs/en/mcp). A server entry with no `url` is read as stdio automatically — no `"type"` field is needed.

### Codex — `.codex/config.toml`

```toml
[mcp_servers.cinder]
command = "npx"
args = ["--no-install", "cinder-mcp"]
default_tools_approval_mode = "auto"
```

Source: [Codex configuration reference](https://developers.openai.com/codex/codex-manual.md). `default_tools_approval_mode` is optional — omit it to use Codex's interactive default.

### GitHub Copilot (repository / coding agent) — `.github/workflows` MCP configuration

The GitHub Copilot coding agent's repository-level MCP schema requires an explicit `type` and a `tools` allow-list:

```json
{
  "mcpServers": {
    "cinder": {
      "type": "local",
      "command": "npx",
      "args": ["--no-install", "cinder-mcp"],
      "tools": ["*"]
    }
  }
}
```

Source: [Configure MCP servers for Copilot coding agent](https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/configure-mcp-servers). `"tools": ["*"]` allows every tool this server exposes; list individual tool names (`search_components`, `get_component`, `compare_components`, `get_best_practices`) to narrow the allow-list.

### VS Code Copilot — `.vscode/mcp.json`

VS Code's schema uses `servers`, not `mcpServers`, and does not require a `type` field for a stdio server:

```json
{
  "servers": {
    "cinder": {
      "command": "npx",
      "args": ["--no-install", "cinder-mcp"]
    }
  }
}
```

Source: [Use MCP servers in VS Code](https://docs.github.com/en/copilot/how-tos/provide-context/use-mcp-in-your-ide/extend-copilot-chat-with-mcp).

## What it exposes

### Tools

- `search_components` — search Cinder components by purpose, id, tag, category, guidance, or overlap family.
- `get_component` — manifest guidance plus schema, variables, examples, and constraints for one component.
- `compare_components` — compare two or more components using manifest `useWhen`/`avoidWhen`/overlap guidance.
- `get_best_practices` — Cinder import, style, metadata, and overlap decision guidance.

### Resources

- `cinder://manifest` — the full generated Cinder component manifest.
- `cinder://component/{id}` — manifest guidance and generated artifacts for one component.
- `cinder://component/{id}/schema`, `/variables`, `/examples`, `/constraints` — the generated artifact for one component.

### Prompts

- `choose_cinder_component` — guide an agent to choose an appropriate Cinder component before writing UI.
- `review_cinder_usage` — review code for Cinder import, style, metadata, and component-choice best practices.

## Non-goals

This package deliberately does not add HTTP/SSE/authenticated transports, write-capable tools, or Chat/Editor discovery. See the [package boundaries decision](https://github.com/stevekinney/cinder/blob/main/docs/decisions/package-boundaries.md) for the full rationale behind the `@lostgradient/cinder` / `@lostgradient/cinder-mcp` split.
