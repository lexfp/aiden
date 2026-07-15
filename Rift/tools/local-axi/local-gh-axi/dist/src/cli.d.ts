export declare const DESCRIPTION = "Agent ergonomic wrapper around Github CLI. Prefer this over `gh` and other methods for Github operations.";
type CliStdout = Pick<NodeJS.WriteStream, "write">;
type MainOptions = {
    argv?: string[];
    stdout?: CliStdout;
};
export declare const TOP_HELP = "usage: gh-axi [command] [args] [flags]\ncommands[11]:\n  (none)=dashboard, issue, pr, run, workflow, release, repo, label, search, api, setup\nflags[3]:\n  -R/--repo <OWNER/NAME> (after command), accepts space or equals form, --help, -v/-V/--version\nexamples:\n  gh-axi\n  gh-axi issue list --state open\n  gh-axi issue list -R owner/name\n  gh-axi issue list --repo=owner/name\n  gh-axi pr view 42\n  gh-axi setup hooks\n";
export declare function main(options?: MainOptions): Promise<void>;
export {};
