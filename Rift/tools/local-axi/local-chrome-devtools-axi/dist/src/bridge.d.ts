/**
 * Persistent MCP bridge server for chrome-devtools-axi.
 *
 * Spawns chrome-devtools-mcp as a child process and maintains a single
 * persistent MCP session. Exposes a simple HTTP API:
 *   POST /call  { name, args }  → { result }
 *   GET  /tools                 → [{ name, description }]
 *   GET  /health                → { status: "ok" } or 503 { status: "error", error }
 *   GET  /health?deep=1         → also verifies the attached CDP target; 503 may include reason
 *
 * Writes a PID file to ~/.chrome-devtools-axi/bridge.pid on startup.
 */
import { type IncomingMessage, type Server, type ServerResponse } from "node:http";
export interface BridgeContentBlock {
    type: string;
    text?: string;
}
export interface BridgeCallPayload {
    name: string;
    args: Record<string, unknown>;
}
interface BridgeToolDescription {
    name: string;
    description?: string;
}
export interface BridgeClient {
    listTools(): Promise<{
        tools: BridgeToolDescription[];
    }>;
    callTool(request: {
        name: string;
        arguments: Record<string, unknown>;
    }): Promise<unknown>;
    close(): Promise<void>;
}
export declare function isBridgeClientConnected(client: BridgeClient): Promise<boolean>;
/**
 * Probe whether the bridge's underlying CDP target is reachable. Drives one
 * round-trip MCP tool call (`list_pages`) that requires a live browser/CDP
 * connection — `listTools()` alone only confirms the local MCP server is up,
 * not that the attached browser is still alive. Used by `/health?deep=1` so
 * `ensureBridge` can detect a stale bridge after the user kills + restarts
 * the underlying Chrome/Electron target.
 */
export declare function isBridgeTargetReachable(client: BridgeClient): Promise<{
    ok: true;
} | {
    ok: false;
    reason: string;
}>;
export declare function getErrorMessage(error: unknown): string;
export declare function extractToolText(content: BridgeContentBlock[]): string;
export declare function parseBridgeCallPayload(body: string): BridgeCallPayload;
export declare function resolveBridgeScript(importMetaDir: string): string;
export declare function handleBridgeRequest(client: BridgeClient, req: IncomingMessage, res: ServerResponse): Promise<void>;
export declare function createBridgeServer(client: BridgeClient): Server;
export declare function buildTransportArgs(): string[];
/**
 * Probe interface for {@link detectGlobalMcpPath}. Defaults to real `node:fs`
 * + `npm prefix -g`; injectable for tests.
 */
export interface McpPathProbe {
    existsSync: (path: string) => boolean;
    getNpmPrefix: () => string | null;
}
/**
 * Auto-detect a globally-installed chrome-devtools-mcp by probing
 * `$(npm prefix -g)/lib/node_modules/chrome-devtools-mcp/build/src/bin/chrome-devtools-mcp.js`.
 *
 * Returns the resolved path on success, or null if npm is unavailable or the
 * package isn't installed. Used as the auto-fallback in
 * {@link resolveTransportSpec} when `CHROME_DEVTOOLS_AXI_MCP_PATH` isn't set.
 */
export declare function detectGlobalMcpPath(probe?: McpPathProbe): string | null;
/**
 * Resolve the command + args used to spawn the chrome-devtools-mcp transport.
 *
 * Resolution order (most → least specific):
 *   1. `CHROME_DEVTOOLS_AXI_MCP_PATH` env var — explicit override, always wins.
 *   2. Auto-detect: probe a globally-installed `chrome-devtools-mcp` via
 *      `$(npm prefix -g)/lib/node_modules/chrome-devtools-mcp/build/src/bin/chrome-devtools-mcp.js`.
 *      If found, spawn `node <path>` directly — starts in ~1-2s vs. the
 *      30s+ npx-bootstrap path.
 *   3. Fall back to `npx -y chrome-devtools-mcp@1.4.0`. On systems with a
 *      slow link or large global cache this can race the bridge's readiness
 *      deadline; install the package globally to skip it:
 *        npm install -g chrome-devtools-mcp
 */
export declare function resolveTransportSpec(probe?: McpPathProbe): {
    command: string;
    args: string[];
};
export declare function runBridge(port?: number): Promise<void>;
export {};
