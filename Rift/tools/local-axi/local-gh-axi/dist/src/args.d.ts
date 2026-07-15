/** Get a flag's value from --flag value or --flag=value without modifying args. */
export declare function getFlag(args: string[], name: string): string | undefined;
/** Get a flag's value from --flag value or --flag=value and remove it from args. */
export declare function takeFlag(args: string[], flag: string): string | undefined;
/** Check if a boolean flag is present. */
export declare function hasFlag(args: string[], flag: string): boolean;
/** Check if a boolean flag is present and remove it from args. */
export declare function takeBoolFlag(args: string[], flag: string): boolean;
/** Collect all values for a repeatable flag in --flag value or --flag=value form. */
export declare function getAllFlags(args: string[], flag: string): string[];
/** Get the first positional arg (non-flag) starting from startIndex. */
export declare function getPositional(args: string[], startIndex: number): string | undefined;
/** Parse and validate a required numeric argument. */
export declare function requireNumber(raw: string | undefined, label: string): number;
/** Find the first numeric positional arg, remove it from args, and return it as a number. */
export declare function takeNumber(args: string[], label: string): number;
