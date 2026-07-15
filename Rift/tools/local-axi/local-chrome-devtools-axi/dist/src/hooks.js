import { homedir } from "node:os";
import { join } from "node:path";
import { computeCodexConfigUpdate as computeAxiCodexConfigUpdate, computeSessionStartHookUpdate, installSessionStartHooks, shouldInstallHooksForNodeAxiExecPath, } from "axi-sdk-js";
const HOOK_MARKER = "chrome-devtools-axi";
/**
 * Only install hooks from packaged or installed entrypoints.
 * Development TypeScript entrypoints should not self-register.
 */
export function shouldInstallHooksForExecPath(execPath) {
    return shouldInstallHooksForNodeAxiExecPath(execPath, {
        marker: HOOK_MARKER,
        binaryNames: [HOOK_MARKER],
        distEntrypoints: ["dist/bin/chrome-devtools-axi.js"],
    });
}
/**
 * Returns hook installation targets for supported agents.
 */
export function getHookTargets() {
    const home = homedir();
    return [
        { path: join(home, ".claude", "settings.json") },
        { path: join(home, ".codex", "hooks.json") },
        { path: join(home, ".codex", "config.toml") },
    ];
}
/**
 * Pure function: compute the hook update for agent settings.
 * Works for both Claude Code (settings.json) and Codex CLI (hooks.json).
 * Returns [updatedSettings, changed].
 */
export function computeHookUpdate(settings, execPath) {
    return computeSessionStartHookUpdate(settings, {
        marker: HOOK_MARKER,
        command: execPath,
        timeoutSeconds: 10,
    });
}
/**
 * Pure function: ensure Codex hooks are enabled in config.toml.
 * Returns [updatedToml, changed].
 */
export function computeCodexConfigUpdate(content) {
    return computeAxiCodexConfigUpdate(content);
}
/**
 * Idempotently install session hooks into all supported agents.
 * Silently does nothing on any error.
 *
 * LOCAL-AXI NOTE: this silent best-effort variant has NO callers (only
 * installHooksOrThrow is used, gated behind the explicit `setup hooks` command).
 * It MUST NEVER be wired into a startup/import path — doing so would write to
 * ~/.claude / ~/.codex automatically, violating the "hooks are opt-in" guarantee.
 */
export function installHooks() {
    try {
        installHooksOrThrow();
    }
    catch {
        // Best-effort — never fail the CLI over hook installation
    }
}
export function installHooksOrThrow() {
    const errors = [];
    installSessionStartHooks({
        marker: HOOK_MARKER,
        timeoutSeconds: 10,
        shouldInstall: shouldInstallHooksForExecPath,
        onError: (message) => {
            errors.push(message);
        },
    });
    if (errors.length > 0) {
        throw new Error(errors.join("\n"));
    }
}
//# sourceMappingURL=hooks.js.map