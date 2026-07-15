/**
 * Script runner for `chrome-devtools-axi run`.
 *
 * Reads a script from stdin, provides a minimal `page` global, and executes it.
 * Only the script's own console.log output is visible to the caller.
 */
import { mkdtempSync, writeFileSync, unlinkSync, rmdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { CdpError } from "./client.js";
import { parseStampedUid } from "./snapshot.js";
// --- JS expression wrapping ---
/**
 * If `s` is a no-arg IIFE of the form `(<fn-expr>)()`, return `<fn-expr>`.
 * Returns `s` unchanged otherwise. Walks parens with depth-tracking and
 * skips string literals so nested parens inside strings don't fool us.
 *
 * Conservative: only unwraps when the trailing call is `()` (empty args),
 * which covers the common documented IIFE form.
 */
function unwrapNoArgIIFE(s) {
    const candidate = s.endsWith(";") ? s.slice(0, -1).trimEnd() : s;
    if (candidate.length < 4 ||
        candidate[0] !== "(" ||
        !candidate.endsWith(")")) {
        return s;
    }
    let depth = 0;
    let inString = null;
    let escape = false;
    let closeIdx = -1;
    for (let i = 0; i < candidate.length; i++) {
        const c = candidate[i];
        if (escape) {
            escape = false;
            continue;
        }
        if (inString) {
            if (c === "\\") {
                escape = true;
                continue;
            }
            if (c === inString)
                inString = null;
            continue;
        }
        if (c === '"' || c === "'" || c === "`") {
            inString = c;
            continue;
        }
        if (c === "(")
            depth++;
        else if (c === ")") {
            depth--;
            if (depth === 0) {
                closeIdx = i;
                break;
            }
        }
    }
    if (closeIdx < 0)
        return s;
    const rest = candidate.slice(closeIdx + 1).trim();
    if (rest !== "()")
        return s;
    const inner = candidate.slice(1, closeIdx).trim();
    if (/^(async\s*)?(\(.*?\)\s*=>|[a-zA-Z_$][a-zA-Z0-9_$]*\s*=>|function[\s*(])/.test(inner)) {
        return inner;
    }
    return s;
}
/** Wrap plain JS expressions for MCP evaluate_script, but pass functions through unchanged. */
export function wrapJsExpression(js) {
    const trimmed = unwrapNoArgIIFE(js.trim());
    if (/^(async\s*)?(\(.*?\)\s*=>|[a-zA-Z_$][a-zA-Z0-9_$]*\s*=>|function[\s*(])/.test(trimmed)) {
        return trimmed;
    }
    return `() => (${trimmed})`;
}
// --- Value parsing ---
/** Extract the actual JS value from MCP evaluate_script response wrapper. */
export function parseEvalOutput(output) {
    const jsonBlock = output.match(/```json\n([\s\S]*?)\n```/);
    if (jsonBlock) {
        try {
            return JSON.parse(jsonBlock[1].trim());
        }
        catch {
            return jsonBlock[1].trim();
        }
    }
    const preamble = "Script ran on page and returned:";
    if (output.includes(preamble)) {
        const raw = output.slice(output.indexOf(preamble) + preamble.length).trim();
        try {
            return JSON.parse(raw);
        }
        catch {
            return raw;
        }
    }
    return output.trim();
}
/** Strip MCP preamble/headers from snapshot text, returning just the accessibility tree. */
function stripSnapshotHeader(text) {
    const lines = text.split("\n");
    const treeStart = lines.findIndex((l) => /\bRootWebArea\b|\buid=/.test(l));
    if (treeStart > 0)
        return lines.slice(treeStart).join("\n");
    return text.replace(/^[\s\S]*?##\s+Latest page snapshot\s*\n/, "");
}
/** Strip leading @ from uid ref string. */
function parseUid(ref) {
    return parseStampedUid(ref).uid;
}
/** Check if an open error is recoverable by falling back to new_page. */
function isRecoverableOpenError(error) {
    if (!(error instanceof CdpError))
        return false;
    if (error.code !== "BROWSER_ERROR")
        return false;
    return /not connected|session (?:closed|not found)|no page/i.test(error.message);
}
// --- Selector detection ---
const UID_RE = /^@?(?:\d[\d_]*|g\d+:.+)$/;
/** Returns true when the string looks like a @uid ref (e.g. "@12", "26_181"). */
export function isUidRef(s) {
    return UID_RE.test(s);
}
const DEFAULT_WAIT_TIMEOUT = 30_000;
export function createPageHelper(callTool) {
    /** Run JS in the page and return the parsed value. */
    async function evalJs(code) {
        const output = await callTool("evaluate_script", { function: code });
        return parseEvalOutput(output);
    }
    return {
        async open(url) {
            if (!url) {
                throw new CdpError("Missing URL", "VALIDATION_ERROR", [
                    'Start with `await page.open("https://example.com")`',
                ]);
            }
            try {
                await callTool("navigate_page", { type: "url", url });
            }
            catch (error) {
                if (!isRecoverableOpenError(error))
                    throw error;
                await callTool("new_page", { url });
            }
            const info = await evalJs(`() => ({ url: location.href, status: performance.getEntriesByType('navigation').pop()?.responseStatus ?? null })`);
            const result = info;
            return {
                url: String(result?.url ?? url),
                status: typeof result?.status === "number" ? result.status : null,
            };
        },
        async eval(jsOrFn) {
            const fn = typeof jsOrFn === "function"
                ? String(jsOrFn)
                : wrapJsExpression(jsOrFn);
            return evalJs(fn);
        },
        async wait(msOrSelector, timeout) {
            if (typeof msOrSelector === "number") {
                await callTool("evaluate_script", {
                    function: `new Promise(r => setTimeout(r, ${msOrSelector}))`,
                });
            }
            else {
                const ms = timeout ?? DEFAULT_WAIT_TIMEOUT;
                const sel = JSON.stringify(msOrSelector);
                await callTool("evaluate_script", {
                    function: `new Promise((resolve, reject) => {
  const sel = ${sel};
  if (document.querySelector(sel)) { resolve(); return; }
  const observer = new MutationObserver(() => {
    if (document.querySelector(sel)) {
      observer.disconnect();
      clearTimeout(timer);
      resolve();
    }
  });
  const timer = setTimeout(() => {
    observer.disconnect();
    reject(new Error('Timeout waiting for: ' + sel));
  }, ${ms});
  observer.observe(document.body, { childList: true, subtree: true, attributes: true });
})`,
                });
            }
        },
        async snapshot() {
            const result = await callTool("take_snapshot");
            return stripSnapshotHeader(result);
        },
        async click(refOrSelector) {
            if (isUidRef(refOrSelector)) {
                await callTool("click", { uid: parseUid(refOrSelector) });
            }
            else {
                const sel = JSON.stringify(refOrSelector);
                await callTool("evaluate_script", {
                    function: `(() => {
  const el = document.querySelector(${sel});
  if (!el) throw new Error('Element not found: ' + ${sel});
  el.scrollIntoView({ block: 'center' });
  el.click();
})()`,
                });
            }
        },
        async fill(refOrSelector, text) {
            if (isUidRef(refOrSelector)) {
                await callTool("fill", { uid: parseUid(refOrSelector), value: text });
            }
            else {
                const sel = JSON.stringify(refOrSelector);
                const val = JSON.stringify(text);
                await callTool("evaluate_script", {
                    function: `(() => {
  const el = document.querySelector(${sel});
  if (!el) throw new Error('Element not found: ' + ${sel});
  el.focus();
  el.value = ${val};
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
})()`,
                });
            }
        },
        async type(text) {
            await callTool("type_text", { text });
        },
        async press(key) {
            await callTool("press_key", { key });
        },
        async back() {
            await callTool("navigate_page", { type: "back" });
        },
    };
}
/** Read all of stdin into a string. */
export async function readStdin() {
    const chunks = [];
    for await (const chunk of process.stdin) {
        chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    }
    return Buffer.concat(chunks).toString("utf-8");
}
export async function runScript(content, callTool) {
    const page = createPageHelper(callTool);
    // Write to a temp .mjs so dynamic import supports top-level await
    const tmpDir = mkdtempSync(join(tmpdir(), "cda-run-"));
    const tmpFile = join(tmpDir, "script.mjs");
    writeFileSync(tmpFile, content, "utf-8");
    // Capture console.log output from the script
    const lines = [];
    const origLog = console.log;
    const captureLog = (...args) => {
        lines.push(args.map(String).join(" "));
    };
    // Inject page global and capture console
    const prevPage = globalThis.page;
    globalThis.page = page;
    console.log = captureLog;
    try {
        const mod = await import(tmpFile);
        // Support optional default export function
        if (typeof mod.default === "function") {
            await mod.default();
        }
    }
    finally {
        console.log = origLog;
        if (prevPage === undefined) {
            delete globalThis.page;
        }
        else {
            globalThis.page = prevPage;
        }
        // Clean up temp file
        try {
            unlinkSync(tmpFile);
            rmdirSync(tmpDir);
        }
        catch {
            /* best effort */
        }
    }
    const stdout = lines.length > 0 ? lines.join("\n") + "\n" : "";
    return { stdout };
}
//# sourceMappingURL=run.js.map