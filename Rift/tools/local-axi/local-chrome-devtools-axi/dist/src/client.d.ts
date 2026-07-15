/**
 * HTTP client for the chrome-devtools-axi bridge + bridge lifecycle management.
 */
import { AxiError } from "axi-sdk-js";
/**
 * Resolve the bridge readiness deadline in milliseconds.
 *
 * Honors `CHROME_DEVTOOLS_AXI_BRIDGE_TIMEOUT_MS` for systems where npx
 * bootstrap or Chrome launch is slow (>30s). Values below 1s are clamped to
 * 1s to avoid pathological retries.
 */
export declare function resolveBridgeTimeoutMs(): number;
export type ErrorCode = "BRIDGE_NOT_READY" | "REF_NOT_FOUND" | "STALE_REF" | "TIMEOUT" | "BROWSER_ERROR" | "VALIDATION_ERROR" | "UNKNOWN";
export declare class CdpError extends AxiError {
    readonly code: ErrorCode;
    readonly suggestions: string[];
    constructor(message: string, code: ErrorCode, suggestions?: string[]);
}
/**
 * Probe the bridge's `/health` endpoint. With `deep: true`, asks the bridge
 * to drive one CDP-backed MCP call (`list_pages`) so callers can distinguish
 * "MCP server is up but the attached browser is gone" from genuine readiness.
 *
 * Exported for tests; production code uses it via `ensureBridge`.
 */
export declare function checkBridgeHealth(port: number, opts?: {
    deep?: boolean;
}): Promise<boolean>;
export declare function waitForProcessExit(pid: number, timeoutMs: number): Promise<boolean>;
/**
 * Terminate a bridge process and reap its detached process group. Sends
 * SIGTERM, polls up to ~2s for exit, then escalates to SIGKILL on the entire
 * process group so chrome-devtools-mcp / Chrome children can't survive as
 * orphans. Returns once the bridge PID is gone (or the SIGKILL grace window
 * expires).
 */
export declare function terminateBridgeProcess(pid: number, opts?: {
    killProcessGroup?: boolean;
}): Promise<void>;
/**
 * Ensure the bridge is running, starting it if needed. Returns the port.
 *
 * Verifies a *deep* health check (one round-trip CDP-backed MCP call) before
 * declaring the bridge ready, so a bridge whose attached browser/Electron
 * target was killed while still answering local /health requests gets torn
 * down + restarted instead of being reused as a stale endpoint.
 */
export declare function ensureBridge(): Promise<number>;
/**
 * Call an MCP tool via the bridge. Returns the text result.
 */
export declare function callTool(name: string, args?: Record<string, unknown>): Promise<string>;
export declare function mapErrorMessage(message: string): CdpError;
/**
 * Get the current page snapshot without starting the bridge.
 * Returns null if the bridge is not running or healthy.
 */
export declare function getSessionSnapshotIfRunning(): Promise<string | null>;
/**
 * Stop the bridge process. Waits for the bridge PID to actually exit (bounded
 * poll, ~2s) before escalating to SIGKILL on the entire detached process
 * group, so chrome-devtools-mcp + Chrome children get reaped together rather
 * than orphaned. Resolves once the bridge process is gone.
 */
export declare function stopBridge(): Promise<boolean>;
