---
'@lostgradient/cinder': minor
'@lostgradient/cinder-mcp': minor
---

Extract the Cinder MCP server into a standalone `@lostgradient/cinder-mcp` package.

`@lostgradient/cinder` no longer ships the `cinder mcp` command, the MCP SDK, or Zod — installing it never pulls in either. It now exposes a Node-only `@lostgradient/cinder/knowledge` subpath so external packages can load Cinder's component metadata without depending on the CLI.

If you were running `cinder mcp`, install `@lostgradient/cinder-mcp` instead:

```sh
npm install --save-dev @lostgradient/cinder-mcp
```

and point your MCP client at the installed binary:

```sh
npx --no-install cinder-mcp
```

Every tool, resource, and prompt keeps its existing name and behavior — see `packages/mcp/README.md` for verified client configuration (Claude Code, Codex, GitHub Copilot, VS Code Copilot). There is no forwarding command or compatibility shim; `cinder mcp` is removed outright.
