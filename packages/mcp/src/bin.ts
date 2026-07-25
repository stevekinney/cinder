#!/usr/bin/env node
import { runMcpServer } from './server.js';

try {
  await runMcpServer();
} catch (error: unknown) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
