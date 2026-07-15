export interface SuggestionContext {
    command: string;
    url?: string;
    snapshot?: string;
}
export declare function getSuggestions(ctx: SuggestionContext): string[];
