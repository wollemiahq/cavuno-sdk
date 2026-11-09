/**
 * `@cavuno/board/mcp` — serve the board's public MCP server at `/mcp` on a
 * self-hosted board's own host. Pure Request → Response; no framework imports.
 */

export {
  createMcpHandler,
  type CreateMcpHandlerConfig,
} from './create-mcp-handler';
