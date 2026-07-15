/**
 * Shared formatting helpers for consistent count and truncation phrasing.
 *
 * Standard phrases:
 *   count: N                                — simple count
 *   count: N of T total                     — when total is known
 *   count: N (showing first N)              — when truncated by limit
 *   count: N+ (GitHub search API limit reached) — search API limit
 */
export function formatCountLine(opts) {
    const { count, limit, totalCount, apiLimitHit, displayLimit } = opts;
    // API limit hit (search)
    if (apiLimitHit) {
        return `count: ${count}+ (GitHub search API limit reached)`;
    }
    // Total count known from GraphQL or API
    if (totalCount !== undefined && totalCount !== null) {
        return `count: ${count} of ${totalCount} total`;
    }
    // Display limit truncation (e.g. search showing first N of results)
    if (displayLimit !== undefined && count > displayLimit) {
        return `count: ${count} (showing first ${displayLimit})`;
    }
    // Hit the request limit — results may be truncated
    if (limit !== undefined && count === limit && count > 0) {
        return `count: ${count} (showing first ${count})`;
    }
    // Simple count
    return `count: ${count}`;
}
//# sourceMappingURL=format.js.map