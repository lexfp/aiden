interface HookEntry {
    type: "command";
    command: string;
    timeout?: number;
}
interface HookGroup {
    matcher: string;
    hooks: HookEntry[];
}
export interface HookSettings {
    hooks?: {
        SessionStart?: HookGroup[];
        [event: string]: HookGroup[] | undefined;
    };
    [key: string]: unknown;
}
export interface HookTarget {
    path: string;
}
/**
 * Only install hooks from packaged or installed entrypoints.
 * Development TypeScript entrypoints should not self-register.
 */
export declare function shouldInstallHooksForExecPath(execPath: string): boolean;
/**
 * Returns hook installation targets for supported agents.
 */
export declare function getHookTargets(): HookTarget[];
/**
 * Pure function: compute the hook update for agent settings.
 * Works for both Claude Code (settings.json) and Codex CLI (hooks.json).
 * Returns [updatedSettings, changed].
 */
export declare function computeHookUpdate(settings: HookSettings, execPath: string): [HookSettings, boolean];
/**
 * Pure function: ensure Codex hooks are enabled in config.toml.
 * Returns [updatedToml, changed].
 */
export declare function computeCodexConfigUpdate(content: string): [string, boolean];
/**
 * Idempotently install session hooks into all supported agents.
 * Silently does nothing on any error.
 */
export declare function installHooks(): void;
export declare function installHooksOrThrow(): void;
export {};
