export declare const SKILL_DESCRIPTION: string;
/**
 * Extract the `commands[N]:` block from the top-level help so the skill's
 * command list can never drift from what `chrome-devtools-axi --help` prints.
 */
export declare function extractCommandsBlock(): string;
/**
 * Render the installable SKILL.md for the chrome-devtools-axi skill. The body is
 * built from the same shared guidance the CLI prints (home description and
 * top-level help), rewriting invocations to non-interactive
 * `npx -y chrome-devtools-axi ...` so the CLI comes along on demand.
 *
 * @returns full SKILL.md contents including YAML frontmatter
 */
export declare const SKILL_AUTHOR = "Kun Chen (kunchenguid)";
export declare const SKILL_HERMES_TAGS: readonly ["browser", "chrome", "automation", "devtools"];
export declare const SKILL_HERMES_CATEGORY = "automation";
export declare function createSkillMarkdown(): string;
