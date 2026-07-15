export declare const SKILL_DESCRIPTION: string;
export declare const SKILL_AUTHOR = "Kun Chen (kunchenguid)";
export declare const HERMES_TAGS: string[];
export declare const HERMES_CATEGORY = "devops";
/**
 * Extract the `commands[N]:` block from the top-level help so the skill's
 * command list can never drift from what `gh-axi --help` prints.
 */
export declare function extractCommandsBlock(): string;
/**
 * Render the installable SKILL.md for the gh-axi skill. The body is built
 * from the same shared guidance the CLI prints (description and top-level
 * help), rewriting invocations to non-interactive `npx -y gh-axi ...` so the
 * CLI comes along on demand.
 *
 * @returns full SKILL.md contents including YAML frontmatter
 */
export declare function createSkillMarkdown(): string;
