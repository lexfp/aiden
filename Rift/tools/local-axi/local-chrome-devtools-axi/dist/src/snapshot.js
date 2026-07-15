/** Count interactive refs (uid=...) in snapshot text. */
export function countRefs(snapshot) {
    const matches = snapshot.match(/\buid=\S+/g);
    return matches ? matches.length : 0;
}
/** Extract ref IDs with labels and types from snapshot text. */
export function extractRefs(snapshot) {
    const refs = [];
    for (const line of snapshot.split("\n")) {
        const m = line.match(/\buid=(\S+)\s+(\w+)\s+"([^"]*)"/);
        if (!m)
            continue;
        refs.push({ ref: m[1], type: m[2], label: m[3] });
    }
    return refs;
}
/**
 * Parse a uid argument that may carry an `@` prefix and/or a generation tag.
 * Examples: `@g7:237_15` -> { uid: "237_15", generation: 7 }
 *           `@237_15`    -> { uid: "237_15", generation: null }
 *           `g3:abc`     -> { uid: "abc", generation: 3 }
 */
export function parseStampedUid(arg) {
    const stripped = arg.startsWith("@") ? arg.slice(1) : arg;
    const m = stripped.match(/^g(\d+):(.+)$/);
    if (m)
        return { uid: m[2], generation: Number.parseInt(m[1], 10) };
    return { uid: stripped, generation: null };
}
/**
 * Rewrite every `uid=<id>` token in snapshot text to carry a generation tag,
 * e.g. `uid=237_15` -> `uid=g7:237_15`. Already-stamped tokens are left alone
 * so this is idempotent. Agents detect re-render churn by feeding tagged refs
 * back to action commands - mismatched generations fail loudly instead of
 * silently no-op'ing against a stale tree.
 */
export function stampSnapshotGeneration(snapshot, generation) {
    return snapshot.replace(/\buid=(\S+)/g, (match, uid) => {
        if (/^g\d+:/.test(uid))
            return match;
        return `uid=g${generation}:${uid}`;
    });
}
/**
 * Pure validation: given a ref argument and the current snapshot generation,
 * return the upstream uid plus whether the ref is stale. Untagged refs are
 * accepted (legacy compatibility) and reported as not-stale.
 */
export function checkUidGeneration(arg, currentGeneration) {
    const { uid, generation } = parseStampedUid(arg);
    return {
        uid,
        stale: generation !== null && generation !== currentGeneration,
        refGeneration: generation,
    };
}
/** Extract page title from snapshot (RootWebArea or first heading). */
export function extractTitle(snapshot) {
    const rootMatch = snapshot.match(/RootWebArea\s+"([^"]+)"/);
    if (rootMatch)
        return rootMatch[1];
    const headingMatch = snapshot.match(/\bheading\s+"([^"]+)"/);
    if (headingMatch)
        return headingMatch[1];
    return "";
}
export function truncateSnapshot(snapshot, full, limit = 16000) {
    const totalLength = snapshot.length;
    if (full || totalLength <= limit) {
        return { text: snapshot, truncated: false, totalLength };
    }
    const cut = snapshot.lastIndexOf("\n", limit);
    const text = cut > 0 ? snapshot.slice(0, cut) : snapshot.slice(0, limit);
    return { text, truncated: true, totalLength };
}
/**
 * Truncate arbitrary text keeping both head and tail so recent/trailing data is preserved.
 * Used for eval output where the end of the result is often as important as the beginning.
 */
const MARKER_OVERHEAD = 50;
export function truncateText(text, limit = 8000) {
    const totalLength = text.length;
    if (totalLength <= limit) {
        return { text, truncated: false, totalLength };
    }
    // The omission marker adds overhead; skip truncation when
    // the text is short enough that truncating would produce a longer result.
    if (totalLength <= limit + MARKER_OVERHEAD) {
        return { text, truncated: false, totalLength };
    }
    const headBudget = Math.floor(limit * 0.4);
    const tailBudget = limit - headBudget;
    // Cut at line boundaries when possible
    const headCut = text.lastIndexOf("\n", headBudget);
    const head = headCut > 0 ? text.slice(0, headCut) : text.slice(0, headBudget);
    const tailStart = text.indexOf("\n", totalLength - tailBudget);
    const tail = tailStart > 0 && tailStart < totalLength
        ? text.slice(tailStart + 1)
        : text.slice(totalLength - tailBudget);
    const omitted = totalLength - head.length - tail.length;
    const result = `${head}\n\n... (${omitted} chars omitted, ${totalLength} total) ...\n\n${tail}`;
    return { text: result, truncated: true, totalLength };
}
const INPUT_TYPES = ["textbox", "searchbox", "input", "combobox", "textarea"];
/** Check if a ref type is an input/form field. */
export function isInputType(type) {
    return INPUT_TYPES.includes(type);
}
//# sourceMappingURL=snapshot.js.map