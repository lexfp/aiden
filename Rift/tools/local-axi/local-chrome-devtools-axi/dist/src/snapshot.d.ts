export interface RefInfo {
    ref: string;
    label: string;
    type: string;
}
/** Count interactive refs (uid=...) in snapshot text. */
export declare function countRefs(snapshot: string): number;
/** Extract ref IDs with labels and types from snapshot text. */
export declare function extractRefs(snapshot: string): RefInfo[];
export interface ParsedUid {
    /** The raw upstream uid (without @ prefix and without generation tag). */
    uid: string;
    /** The snapshot generation the ref was minted in, or null if untagged (legacy). */
    generation: number | null;
}
/**
 * Parse a uid argument that may carry an `@` prefix and/or a generation tag.
 * Examples: `@g7:237_15` -> { uid: "237_15", generation: 7 }
 *           `@237_15`    -> { uid: "237_15", generation: null }
 *           `g3:abc`     -> { uid: "abc", generation: 3 }
 */
export declare function parseStampedUid(arg: string): ParsedUid;
/**
 * Rewrite every `uid=<id>` token in snapshot text to carry a generation tag,
 * e.g. `uid=237_15` -> `uid=g7:237_15`. Already-stamped tokens are left alone
 * so this is idempotent. Agents detect re-render churn by feeding tagged refs
 * back to action commands - mismatched generations fail loudly instead of
 * silently no-op'ing against a stale tree.
 */
export declare function stampSnapshotGeneration(snapshot: string, generation: number): string;
export interface UidCheckResult {
    /** The raw upstream uid (no @ prefix, no generation tag). */
    uid: string;
    /** True when the ref carries a generation tag that does not match current. */
    stale: boolean;
    /** The generation embedded in the ref, or null if the ref was untagged. */
    refGeneration: number | null;
}
/**
 * Pure validation: given a ref argument and the current snapshot generation,
 * return the upstream uid plus whether the ref is stale. Untagged refs are
 * accepted (legacy compatibility) and reported as not-stale.
 */
export declare function checkUidGeneration(arg: string, currentGeneration: number): UidCheckResult;
/** Extract page title from snapshot (RootWebArea or first heading). */
export declare function extractTitle(snapshot: string): string;
export interface TruncationResult {
    text: string;
    truncated: boolean;
    totalLength: number;
}
export declare function truncateSnapshot(snapshot: string, full: boolean, limit?: number): TruncationResult;
export declare function truncateText(text: string, limit?: number): TruncationResult;
/** Check if a ref type is an input/form field. */
export declare function isInputType(type: string): boolean;
