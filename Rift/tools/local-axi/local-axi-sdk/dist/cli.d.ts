import { type AxiRenderable } from "./output.js";
type MaybePromise<T> = T | Promise<T>;
export type AxiCliCommand<TContext> = (args: string[], context: TContext | undefined) => MaybePromise<AxiRenderable>;
export interface AxiResolveContextInput {
    command: string | undefined;
    args: string[];
}
export interface AxiCliOptions<TContext = undefined> {
    description: string;
    version?: string;
    argv?: string[];
    topLevelHelp: string;
    commands: Record<string, AxiCliCommand<TContext>>;
    home: AxiCliCommand<TContext>;
    getCommandHelp?: (command: string) => string | null | undefined;
    initialize?: () => void;
    resolveContext?: (input: AxiResolveContextInput) => MaybePromise<TContext>;
    stdout?: {
        write: (chunk: string) => unknown;
    };
    renderUnknownCommand?: (command: string) => string;
    formatError?: (error: unknown) => {
        output: string;
        exitCode: number;
    };
}
export declare function runAxiCli<TContext = undefined>(options: AxiCliOptions<TContext>): Promise<void>;
export {};
