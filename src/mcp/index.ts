/**
 * `@cavuno/board/mcp` — serve the board's public MCP server at `/mcp` on a
 * self-hosted board's own host, with sign-in from assistants when the site
 * has a consent page. Pure Request → Response; no framework imports.
 */

export {
  createMcpHandler,
  MCP_SITE_HEADER,
  type CreateMcpHandlerConfig,
} from './create-mcp-handler';
