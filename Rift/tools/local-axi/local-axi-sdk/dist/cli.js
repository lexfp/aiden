import { basename } from "node:path";
import { AxiError, exitCodeForError } from "./errors.js";
import { homeHeaderOutput, renderError, renderOutput, } from "./output.js";
function defaultFormatError(error) {
    if (error instanceof AxiError) {
        return {
            output: `${renderError(error.message, error.code, error.suggestions)}\n`,
            exitCode: exitCodeForError(error),
        };
    }
    const message = error instanceof Error ? error.message : String(error);
    return {
        output: `${renderError(message, "UNKNOWN")}\n`,
        exitCode: 1,
    };
}
function defaultUnknownCommand(command) {
    return `${renderError(`Unknown command: ${command}`, "VALIDATION_ERROR", [
        "Run `--help` to see available commands",
    ])}\n`;
}
export async function runAxiCli(options) {
    options.initialize?.();
    const stdout = options.stdout ?? process.stdout;
    const argv = options.argv ?? process.argv.slice(2);
    if (argv.length === 1 && argv[0] === "--help") {
        stdout.write(options.topLevelHelp);
        return;
    }
    if (argv.length === 1 && isVersionFlag(argv[0])) {
        if (!options.version) {
            stdout.write(`${renderError("Version is not configured for this tool", "VALIDATION_ERROR")}\n`);
            process.exitCode = 2;
            return;
        }
        stdout.write(`${options.version}\n`);
        return;
    }
    const command = argv[0];
    if (!command) {
        const context = await options.resolveContext?.({
            command: undefined,
            args: [],
        });
        await runHandler(options.home, [], context, stdout, options, true);
        return;
    }
    if (command.startsWith("-")) {
        stdout.write(renderLeadingFlagError(command));
        process.exitCode = 2;
        return;
    }
    const args = argv.slice(1);
    if (args.includes("--help")) {
        const help = options.getCommandHelp?.(command);
        if (help) {
            stdout.write(help);
            return;
        }
    }
    const handler = options.commands[command];
    if (!handler) {
        stdout.write((options.renderUnknownCommand ?? defaultUnknownCommand)(command));
        process.exitCode = 2;
        return;
    }
    const context = await options.resolveContext?.({ command, args });
    await runHandler(handler, args, context, stdout, options, false);
}
async function runHandler(handler, args, context, stdout, options, isHomeView) {
    try {
        const output = await handler(args, context);
        stdout.write(`${renderCommandOutput(output, options, isHomeView)}\n`);
    }
    catch (error) {
        const formatted = (options.formatError ?? defaultFormatError)(error);
        stdout.write(formatted.output);
        process.exitCode = formatted.exitCode;
    }
}
function renderLeadingFlagError(flag) {
    const bin = basename(process.argv[1] ?? "tool") || "tool";
    return `${renderError("Flags must come after the command", "VALIDATION_ERROR", [
        `Run \`${bin} <command> [args] [flags]\``,
        `Move \`${flag}\` after the command instead of before it`,
    ])}\n`;
}
function isVersionFlag(flag) {
    return flag === "-v" || flag === "-V" || flag === "--version";
}
function renderCommandOutput(output, options, isHomeView) {
    if (!isHomeView) {
        return renderOutput(output);
    }
    const header = homeHeaderOutput({ description: options.description });
    if (typeof output === "string") {
        return `${renderOutput(header)}\n${output}`;
    }
    return renderOutput(mergeHomeHeader(header, output));
}
function mergeHomeHeader(header, output) {
    const rest = { ...output };
    delete rest.bin;
    delete rest.description;
    return {
        ...header,
        ...rest,
    };
}
