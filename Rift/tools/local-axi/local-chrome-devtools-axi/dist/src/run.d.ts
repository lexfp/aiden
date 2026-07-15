/**
 * Script runner for `chrome-devtools-axi run`.
 *
 * Reads a script from stdin, provides a minimal `page` global, and executes it.
 * Only the script's own console.log output is visible to the caller.
 */
type CallTool = (name: string, args?: Record<string, unknown>) => Promise<string>;
/** Wrap plain JS expressions for MCP evaluate_script, but pass functions through unchanged. */
export declare function wrapJsExpression(js: string): string;
/** Extract the actual JS value from MCP evaluate_script response wrapper. */
export declare function parseEvalOutput(output: string): unknown;
/** Returns true when the string looks like a @uid ref (e.g. "@12", "26_181"). */
export declare function isUidRef(s: string): boolean;
export interface OpenResult {
    url: string;
    status: number | null;
}
export interface PageHelper {
    open(url: string): Promise<OpenResult>;
    eval(jsOrFn: string | ((...args: unknown[]) => unknown)): Promise<unknown>;
    wait(ms: number): Promise<void>;
    wait(selector: string, timeout?: number): Promise<void>;
    snapshot(): Promise<string>;
    click(refOrSelector: string): Promise<void>;
    fill(refOrSelector: string, text: string): Promise<void>;
    type(text: string): Promise<void>;
    press(key: string): Promise<void>;
    back(): Promise<void>;
}
export declare function createPageHelper(callTool: CallTool): PageHelper;
export interface RunResult {
    stdout: string;
}
/** Read all of stdin into a string. */
export declare function readStdin(): Promise<string>;
export declare function runScript(content: string, callTool: CallTool): Promise<RunResult>;
export {};
