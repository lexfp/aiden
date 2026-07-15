import type { RepoContext } from "./context.js";
interface SuggestionContext {
    domain: string;
    action: string;
    state?: string;
    isEmpty?: boolean;
    /** The entity number/id/tag for substitution */
    id?: string | number;
    repo?: RepoContext;
}
export declare function getSuggestions(ctx: SuggestionContext): string[];
export {};
