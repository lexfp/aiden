/**
 * Snapshot generation persistence. The counter survives across CLI
 * invocations (which are short-lived processes sharing one bridge) by
 * writing to a file in STATE_DIR. Each new snapshot bumps the counter,
 * so refs minted in older snapshots can be detected as stale.
 */
export declare function getCurrentGeneration(): number;
export declare function bumpGeneration(): number;
export declare function resetGeneration(): void;
