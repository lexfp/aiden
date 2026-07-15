#!/usr/bin/env node

// src/cli.js
import { spawn, spawnSync } from "node:child_process";
import { closeSync, existsSync, openSync, readFileSync } from "node:fs";
import { access } from "node:fs/promises";
import os2 from "node:os";
import path4 from "node:path";
import { fileURLToPath } from "node:url";
import { AxiError, installSessionStartHooks, runAxiCli } from "axi-sdk-js";

// src/design-reference.js
var TAILWIND_BROWSER_VERSION = "4.2.4";
var DAISYUI_VERSION = "5.5.19";
var DESIGN_CDN_URLS = {
  tailwind: `https://cdn.jsdelivr.net/npm/@tailwindcss/browser@${TAILWIND_BROWSER_VERSION}/dist/index.global.js`,
  daisyui: `https://cdn.jsdelivr.net/npm/daisyui@${DAISYUI_VERSION}/daisyui.css`,
  daisyuiThemes: `https://cdn.jsdelivr.net/npm/daisyui@${DAISYUI_VERSION}/themes.css`
};
var DESIGN_CDN_SNIPPET = `<link rel="stylesheet" href="${DESIGN_CDN_URLS.daisyui}">
<link rel="stylesheet" href="${DESIGN_CDN_URLS.daisyuiThemes}">
<script src="${DESIGN_CDN_URLS.tailwind}"></script>`;
var DESIGN_SYSTEM_HINT = "Lavish does not auto-inject any design system - artifacts stay portable so they render identically when opened directly without lavish-axi running. Before writing any HTML, decide the design direction in this strict priority order, and only move to the next step when the current one truly yields nothing: (1) if the user asked for a specific look or named design system, use that; (2) otherwise you must first inspect the project the artifact is about - the subject or product whose content or UI it represents, which may differ from your current working directory - and match that project's design system: Tailwind or theme config, shared CSS variables or design tokens, component library, brand assets, or existing styled pages. If the artifact previews, proposes, or mocks a specific app's UI, render it in that app's own design system so it faithfully shows the product, even when you are running in a different repo; (3) only when both steps come up empty, use the Lavish-recommended Tailwind CSS browser runtime v4 + DaisyUI v5, available via CDN - run `lavish-axi design` for a copy-pasteable CDN snippet plus component reference, and prefer that CDN snippet over hand-writing styles unless explicitly instructed otherwise by the user. When you deliver the artifact, state which of the three design sources you used and why.";
var DAISYUI_THEMES = [
  "light",
  "dark",
  "cupcake",
  "bumblebee",
  "emerald",
  "corporate",
  "synthwave",
  "retro",
  "cyberpunk",
  "valentine",
  "halloween",
  "garden",
  "forest",
  "aqua",
  "lofi",
  "pastel",
  "fantasy",
  "wireframe",
  "black",
  "luxury",
  "dracula",
  "cmyk",
  "autumn",
  "business",
  "acid",
  "lemonade",
  "night",
  "coffee",
  "winter",
  "dim",
  "nord",
  "sunset",
  "caramellatte",
  "abyss",
  "silk"
];
function createDesignOutput() {
  return {
    design: {
      summary: "Use this Lavish CDN fallback only if (1) the user gave no design direction and (2) you already inspected the project the artifact is about - the subject or product whose content or UI it represents, which may differ from your current working directory - and found no design system or style conventions to match. If you have not checked the subject project yet, check first. Lavish does not auto-inject any design system; artifacts stay portable HTML. The strict priority order is: (1) a look or named design system the user asked for; (2) the subject project's design system or style conventions - look for a Tailwind or theme config, shared CSS variables or design tokens, a component library, brand assets, or existing styled pages. If the artifact previews, proposes, or mocks a specific app's UI, render it in that app's own design system so it faithfully shows the product, even when you are running in a different repo; (3) this Tailwind CSS browser runtime v4 + DaisyUI v5 + themes snippet - paste the CDN snippet below into your `<head>` and prefer the CDN snippet over hand-writing styles unless explicitly instructed otherwise by the user.",
      cdn_snippet: DESIGN_CDN_SNIPPET,
      cdn_urls: DESIGN_CDN_URLS,
      versions: { tailwind: TAILWIND_BROWSER_VERSION, daisyui: DAISYUI_VERSION },
      latest_docs: "https://daisyui.com/components/",
      docs_note: "Use this command for common syntax. Read the latest DaisyUI docs for full details when using advanced or unfamiliar components.",
      other_design_systems: "If the user asks for a different design system (Bootstrap, custom CSS, plain HTML, etc.), use that instead - Lavish does not require DaisyUI."
    },
    theme_usage: [
      'Default to `<html data-theme="luxury">` - it matches the Lavish look. Pick a different theme from the list below only when the user asked for one or the content clearly calls for it.',
      'Set a nested section theme with `<section data-theme="night">`.',
      "Prefer semantic colors such as `bg-base-100`, `bg-base-200`, `text-base-content`, `bg-primary`, `text-primary-content`, `alert-warning`, and `btn-primary` so themes remain readable.",
      "Avoid hardcoded Tailwind color names for text and surfaces unless the user asked for exact colors.",
      "Use Tailwind responsive prefixes such as `sm:`, `md:`, `lg:`, and `xl:` for layout changes.",
      'Never `@apply` DaisyUI classes (such as `text-base-content/40`, `bg-base-200`, or `btn`) inside `<style type="text/tailwindcss">` - the Tailwind browser runtime does not know them, and one unknown utility aborts the entire compile, leaving the page with no Tailwind styles at all. Put DaisyUI classes directly on elements, or write plain CSS with theme variables such as `var(--color-base-200)`.'
    ],
    themes: DAISYUI_THEMES,
    components: {
      actions: ["button", "dropdown", "fab", "modal", "swap", "theme-controller"],
      data_display: [
        "accordion",
        "avatar",
        "badge",
        "card",
        "carousel",
        "chat",
        "collapse",
        "countdown",
        "diff",
        "hover-3d",
        "hover-gallery",
        "kbd",
        "list",
        "stat",
        "status",
        "table",
        "text-rotate",
        "timeline"
      ],
      navigation: ["breadcrumbs", "dock", "link", "menu", "navbar", "pagination", "steps", "tabs"],
      feedback: ["alert", "loading", "progress", "radial-progress", "skeleton", "toast", "tooltip"],
      data_input: [
        "calendar",
        "checkbox",
        "fieldset",
        "file-input",
        "filter",
        "label",
        "radio",
        "range",
        "rating",
        "select",
        "input",
        "textarea",
        "toggle",
        "validator"
      ],
      layout: ["divider", "drawer", "footer", "hero", "indicator", "join", "mask", "stack"],
      mockup: ["mockup-browser", "mockup-code", "mockup-phone", "mockup-window"]
    },
    modifiers: {
      colors: ["neutral", "primary", "secondary", "accent", "info", "success", "warning", "error"],
      sizes: ["xs", "sm", "md", "lg", "xl"],
      styles: ["outline", "dash", "soft", "ghost", "link"],
      placements: ["start", "center", "end", "top", "middle", "bottom", "left", "right"]
    },
    reference: {
      button: {
        classes: [
          "btn",
          "btn-neutral",
          "btn-primary",
          "btn-secondary",
          "btn-accent",
          "btn-info",
          "btn-success",
          "btn-warning",
          "btn-error",
          "btn-outline",
          "btn-dash",
          "btn-soft",
          "btn-ghost",
          "btn-link",
          "btn-xs",
          "btn-sm",
          "btn-md",
          "btn-lg",
          "btn-xl",
          "btn-wide",
          "btn-block",
          "btn-square",
          "btn-circle",
          "btn-active",
          "btn-disabled"
        ],
        syntax: '<button class="btn btn-primary">Save</button>',
        notes: [
          'Use `btn` on `<button>`, `<a role="button">`, `<input>`, or `<label>`.',
          'For class-only disabled state, add `btn-disabled tabindex="-1" role="button" aria-disabled="true"`.',
          "Use `btn-square` or `btn-circle` for icon-only buttons and provide an accessible label."
        ]
      },
      card: {
        classes: [
          "card",
          "card-body",
          "card-title",
          "card-actions",
          "card-border",
          "card-dash",
          "card-side",
          "image-full",
          "card-xs",
          "card-sm",
          "card-md",
          "card-lg",
          "card-xl"
        ],
        syntax: '<div class="card card-border bg-base-100"><div class="card-body"><h2 class="card-title">Title</h2><p>Text</p><div class="card-actions justify-end"><button class="btn btn-primary">Act</button></div></div></div>',
        notes: [
          "Use `lg:card-side` for responsive horizontal cards.",
          "Use `card-border` for a bordered card without custom CSS."
        ]
      },
      alert: {
        classes: [
          "alert",
          "alert-outline",
          "alert-dash",
          "alert-soft",
          "alert-info",
          "alert-success",
          "alert-warning",
          "alert-error",
          "alert-vertical",
          "alert-horizontal"
        ],
        syntax: '<div role="alert" class="alert alert-warning"><span>Check this before shipping.</span></div>',
        notes: [
          'Use `role="alert"` for important status messages.',
          "Use `sm:alert-horizontal` to switch from stacked to horizontal layouts."
        ]
      },
      badge: {
        classes: [
          "badge",
          "badge-outline",
          "badge-dash",
          "badge-soft",
          "badge-ghost",
          "badge-neutral",
          "badge-primary",
          "badge-secondary",
          "badge-accent",
          "badge-info",
          "badge-success",
          "badge-warning",
          "badge-error",
          "badge-xs",
          "badge-sm",
          "badge-md",
          "badge-lg",
          "badge-xl"
        ],
        syntax: '<span class="badge badge-soft badge-warning">Risk</span>',
        notes: ["Use badges for short statuses and labels, not long prose."]
      },
      table: {
        classes: [
          "table",
          "table-zebra",
          "table-pin-rows",
          "table-pin-cols",
          "table-xs",
          "table-sm",
          "table-md",
          "table-lg",
          "table-xl"
        ],
        syntax: '<div class="overflow-x-auto rounded-box border border-base-content/5 bg-base-100"><table class="table table-zebra"><thead><tr><th>Name</th></tr></thead><tbody><tr><td>Value</td></tr></tbody></table></div>',
        notes: ["Wrap tables in `overflow-x-auto` for mobile.", "Use semantic table markup for tabular data."]
      },
      modal: {
        classes: [
          "modal",
          "modal-box",
          "modal-action",
          "modal-backdrop",
          "modal-toggle",
          "modal-open",
          "modal-top",
          "modal-middle",
          "modal-bottom",
          "modal-start",
          "modal-end"
        ],
        syntax: '<button class="btn" onclick="details_modal.showModal()">Open</button><dialog id="details_modal" class="modal"><div class="modal-box"><h3 class="text-lg font-bold">Title</h3><p class="py-4">Content</p><div class="modal-action"><form method="dialog"><button class="btn">Close</button></form></div></div></dialog>',
        notes: [
          "Prefer native `<dialog>` with `showModal()` for accessibility.",
          "Use unique IDs for every modal.",
          "Use `modal-bottom sm:modal-middle` for mobile-friendly responsive placement."
        ]
      },
      collapse: {
        classes: [
          "collapse",
          "collapse-title",
          "collapse-content",
          "collapse-arrow",
          "collapse-plus",
          "collapse-open",
          "collapse-close"
        ],
        syntax: '<div tabindex="0" class="collapse collapse-arrow bg-base-200"><div class="collapse-title">Title</div><div class="collapse-content"><p>Hidden detail</p></div></div>',
        notes: [
          "Use a checkbox child for independently toggleable collapses.",
          "Use radio inputs with the same name for accordion behavior where only one item stays open."
        ]
      },
      drawer: {
        classes: [
          "drawer",
          "drawer-toggle",
          "drawer-content",
          "drawer-side",
          "drawer-overlay",
          "drawer-end",
          "drawer-open"
        ],
        syntax: '<div class="drawer lg:drawer-open"><input id="nav" type="checkbox" class="drawer-toggle"><div class="drawer-content"><label for="nav" class="btn drawer-button lg:hidden">Menu</label></div><div class="drawer-side"><label for="nav" aria-label="close sidebar" class="drawer-overlay"></label><ul class="menu bg-base-200 min-h-full w-80 p-4"><li><button>Item</button></li></ul></div></div>',
        notes: [
          "Every page region belongs inside `drawer-content` or `drawer-side`.",
          "The hidden `drawer-toggle` input needs a unique ID.",
          "Use labels with `for` to open and close the drawer."
        ]
      },
      navbar: {
        classes: ["navbar", "navbar-start", "navbar-center", "navbar-end"],
        syntax: '<div class="navbar bg-base-200"><div class="navbar-start"><a class="btn btn-ghost text-xl">Title</a></div><div class="navbar-end"><button class="btn btn-primary">Action</button></div></div>',
        notes: ["Use the start, center, and end parts to align content horizontally."]
      },
      menu: {
        classes: [
          "menu",
          "menu-title",
          "menu-dropdown",
          "menu-dropdown-toggle",
          "menu-disabled",
          "menu-active",
          "menu-focus",
          "menu-dropdown-show",
          "menu-xs",
          "menu-sm",
          "menu-md",
          "menu-lg",
          "menu-xl",
          "menu-horizontal",
          "menu-vertical"
        ],
        syntax: '<ul class="menu bg-base-200 rounded-box"><li><button class="menu-active">Item</button></li><li><a>Link</a></li></ul>',
        notes: ["Use `lg:menu-horizontal` for responsive menus.", "Use `<details>` for collapsible submenus."]
      },
      tabs: {
        classes: [
          "tabs",
          "tab",
          "tab-active",
          "tab-disabled",
          "tabs-box",
          "tabs-border",
          "tabs-lift",
          "tab-content",
          "tab-xs",
          "tab-sm",
          "tab-md",
          "tab-lg",
          "tab-xl"
        ],
        syntax: '<div role="tablist" class="tabs tabs-border"><button role="tab" class="tab tab-active">One</button><button role="tab" class="tab">Two</button></div>',
        notes: ["Use role attributes when tabs are interactive controls."]
      },
      steps: {
        classes: [
          "steps",
          "step",
          "step-primary",
          "step-secondary",
          "step-accent",
          "step-info",
          "step-success",
          "step-warning",
          "step-error",
          "steps-vertical",
          "steps-horizontal"
        ],
        syntax: '<ul class="steps"><li class="step step-primary">Plan</li><li class="step">Build</li><li class="step">Review</li></ul>',
        notes: ["Use `steps-vertical lg:steps-horizontal` for responsive process views."]
      },
      stat: {
        classes: ["stats", "stat", "stat-title", "stat-value", "stat-desc", "stat-figure", "stat-actions"],
        syntax: '<div class="stats stats-vertical lg:stats-horizontal shadow"><div class="stat"><div class="stat-title">Issues</div><div class="stat-value">3</div><div class="stat-desc">Need review</div></div></div>',
        notes: ["Use stats for key numbers above dense detail."]
      },
      progress: {
        classes: [
          "progress",
          "progress-neutral",
          "progress-primary",
          "progress-secondary",
          "progress-accent",
          "progress-info",
          "progress-success",
          "progress-warning",
          "progress-error",
          "radial-progress"
        ],
        syntax: '<progress class="progress progress-primary" value="70" max="100"></progress><div class="radial-progress" style="--value:70;" role="progressbar" aria-valuenow="70">70%</div>',
        notes: [
          "Progress elements need `value` and `max`.",
          'Radial progress uses `--value`, `role="progressbar"`, and `aria-valuenow`.'
        ]
      },
      forms: {
        classes: [
          "input",
          "textarea",
          "select",
          "checkbox",
          "radio",
          "toggle",
          "range",
          "rating",
          "fieldset",
          "fieldset-legend",
          "label",
          "floating-label",
          "validator"
        ],
        syntax: '<fieldset class="fieldset"><legend class="fieldset-legend">Choice</legend><select class="select"><option>One</option></select><p class="label">Helper text</p></fieldset>',
        notes: [
          "Use unique `name` values for each radio, rating, or filter group.",
          "Use matching color and size modifiers such as `input-primary input-lg` when needed."
        ]
      },
      tooltip_toast: {
        classes: [
          "tooltip",
          "tooltip-open",
          "tooltip-top",
          "tooltip-bottom",
          "tooltip-left",
          "tooltip-right",
          "toast",
          "toast-start",
          "toast-center",
          "toast-end",
          "toast-top",
          "toast-middle",
          "toast-bottom"
        ],
        syntax: '<div class="tooltip" data-tip="More context"><button class="btn">Hover</button></div><div class="toast toast-end"><div class="alert alert-success">Saved</div></div>',
        notes: ["Tooltips use `data-tip` for text.", "Toast is a positioned wrapper; put `alert` content inside."]
      },
      mockup: {
        classes: [
          "mockup-browser",
          "mockup-browser-toolbar",
          "mockup-code",
          "mockup-phone",
          "mockup-phone-camera",
          "mockup-phone-display",
          "mockup-window"
        ],
        syntax: '<div class="mockup-code"><pre data-prefix="$"><code>npm test</code></pre></div>',
        notes: [
          "Use `pre data-prefix` for short command prompts, symbols, or line numbers.",
          "Keep `data-prefix` short because DaisyUI renders it in the code gutter; use prose outside the mockup for long labels.",
          "Use mockups for product or terminal examples, not regular prose."
        ]
      },
      utility_rules: {
        classes: [
          "hero",
          "hero-content",
          "divider",
          "join",
          "join-item",
          "indicator",
          "indicator-item",
          "avatar",
          "chat",
          "chat-start",
          "chat-end",
          "loading",
          "skeleton",
          "diff",
          "timeline"
        ],
        syntax: '<main class="mx-auto max-w-6xl p-6 lg:p-10"><section class="hero bg-base-200 rounded-box"><div class="hero-content text-center"><h1 class="text-5xl font-bold">Review surface</h1></div></section></main>',
        notes: [
          "Compose DaisyUI components with Tailwind utilities for spacing, grid, flex, width, and typography.",
          "Prefer component classes over custom CSS for common UI."
        ]
      }
    }
  };
}

// src/paths.js
import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
var LOOPBACK_HOST = "127.0.0.1";
var IPV6_LOOPBACK_HOST = "::1";
var WILDCARD_BIND_LOOPBACK = /* @__PURE__ */ new Map([
  ["0.0.0.0", LOOPBACK_HOST],
  ["::", IPV6_LOOPBACK_HOST]
]);
function bindHost(env = process.env) {
  return env.LAVISH_AXI_HOST?.trim() || LOOPBACK_HOST;
}
function clientHost(env = process.env) {
  const host = bindHost(env);
  return WILDCARD_BIND_LOOPBACK.get(host) ?? host;
}
function linkHost(env = process.env) {
  return env.LAVISH_AXI_LINK_HOST?.trim() || clientHost(env);
}
function hostForUrl(host) {
  if (host.includes(":") && !host.startsWith("[")) return `[${host}]`;
  return host;
}
function stateDir() {
  return process.env.LAVISH_AXI_STATE_DIR || path.join(os.homedir(), ".lavish-axi");
}
function stateFile() {
  return path.join(stateDir(), "state.json");
}
function serverLogFile() {
  return path.join(stateDir(), "server.log");
}
async function ensureStateDir() {
  await mkdir(stateDir(), { recursive: true });
}
function defaultPort() {
  return Number(process.env.LAVISH_AXI_PORT || 4387);
}

// src/playbooks.js
var PLAYBOOKS = [
  {
    id: "diagram",
    use_when: "Map relationships, flows, state, and architecture",
    choose: [
      "Use Mermaid when automatic node placement and edge routing matter more than rich card content.",
      "Use CSS grid, SVG, or positioned HTML when each item needs prose, code, controls, or detailed annotations.",
      "Use a hybrid shape for large systems: a small overview diagram followed by detailed module cards."
    ],
    structure: [
      "Lead with the question the diagram answers, not with the implementation detail that produced it.",
      "Keep the first visual to the core relationship, then put dense evidence or file references below it.",
      "For complex systems, separate topology from detail so the overview stays readable."
    ],
    design_rules: [
      "Use page-scoped class names and avoid generic names like .node that can collide with diagram libraries.",
      "Prefer top-down flow for multi-step diagrams unless the flow is genuinely linear and short.",
      "Quote labels that contain punctuation or code-like names, and use explicit line breaks where the renderer supports them."
    ],
    pitfalls: [
      "Do not cram every file or function into one diagram when a layered explanation would be clearer.",
      "Do not let default diagram colors clash with the page palette or dark mode.",
      "Do not present unverified architecture claims as facts. Cite the files or commands that support them."
    ],
    lavish_notes: [
      "A Lavish diagram should invite precise annotation: make modules, edges, and captions easy to click and discuss.",
      "When a relationship is uncertain, label it as a question so the user can resolve it in the review loop."
    ]
  },
  {
    id: "table",
    use_when: "Turn dense records into scan-friendly review surfaces",
    choose: [
      "Use a table when rows share the same fields and the user needs to compare evidence quickly.",
      "Use cards when each record has a different shape or needs a long explanation.",
      "Use summaries above the table when counts, risk levels, or statuses change how the table should be read."
    ],
    structure: [
      "Start with a short summary of what the rows prove or require.",
      "Group columns by the decision they support: identity, evidence, status, action.",
      "Keep raw details available, but make the primary status visible without reading every cell."
    ],
    design_rules: [
      "Use semantic table markup when the data is tabular.",
      "Protect long paths, code symbols, URLs, and prose from overflowing on narrow screens.",
      "Use restrained color for status and severity so the table remains readable when printed or skimmed."
    ],
    pitfalls: [
      "Do not paste a terminal table into HTML and call it done.",
      "Do not hide the important conclusion below a large undifferentiated grid.",
      "Do not use color as the only status signal."
    ],
    lavish_notes: [
      "A Lavish table should make individual rows easy annotation targets.",
      "If a row implies a follow-up change, include an action control that queues a specific prompt."
    ]
  },
  {
    id: "comparison",
    use_when: "Show options, tradeoffs, and current vs target behavior",
    choose: [
      "Use before and after when the same system is changing over time.",
      "Use option cards when the user needs to choose between mutually exclusive directions.",
      "Use a scorecard only when the criteria are explicit and comparable."
    ],
    structure: [
      "Name the decision at the top of the artifact.",
      "Show the concrete behavior or artifact shape for each side, not just abstract pros and cons.",
      "End with a recommendation only when the evidence actually supports one."
    ],
    design_rules: [
      "Keep corresponding details aligned so differences are visible without hunting.",
      "Use visual hierarchy to separate primary tradeoffs from secondary notes.",
      "Make the cost of each option as visible as the benefit."
    ],
    pitfalls: [
      "Do not make every option look equally recommended if one is clearly preferred.",
      "Do not compare vague summaries when concrete examples are available.",
      "Do not bury assumptions that would change the recommendation."
    ],
    lavish_notes: [
      "A Lavish comparison should let the user annotate the exact option or tradeoff they want changed.",
      "If the goal is selection, provide controls that queue the chosen option with rationale."
    ]
  },
  {
    id: "plan",
    use_when: "Explain a product or technical plan before implementation",
    choose: [
      "Use this when the user needs to inspect a feature approach before implementation begins.",
      "Use it when the user explicitly asked for a PRD, technical design, implementation plan or proposal.",
      "Use a lighter comparison or diagram playbook when the plan is only a single small design choice."
    ],
    structure: [
      "Start with the goal, the current state, and desired behavior.",
      "Then describe a proposed approach, focusing on high level decisions.",
      "At the end, list any risks you see, and open questions you have, and follow the 'comparison' playbook to provide options for the user to choose from."
    ],
    design_rules: [
      "Verify each claim against the codebase before presenting it as fact.",
      "When discussing frontend experiences, prefer visually mocking the experience under a consistent design system as the real product over describing it with text.",
      "The plan needs to be self-contained enough that another developer can read it and fully implement the proposal."
    ],
    pitfalls: [
      "Do not leave resolved open questions in the artifact. Update existing content to reflect the decision and remove the open question.",
      "Do not only focus on ambiguous decisions and omit the actual proposal.",
      "Do not omit failure modes, migration concerns, or backwards compatibility questions."
    ],
    lavish_notes: ["A Lavish plan should make a plan and its uncertainties easy to annotate before code exists."]
  },
  {
    id: "code",
    use_when: "Render source code, code files, patches, PR diffs, and before/after code inside Lavish artifacts",
    choose: [
      "Use this whenever an artifact shows source code: a snippet, full file, patch, PR diff, local change set, or before/after code.",
      "Use File for one code file, FileDiff for old/new versions or parsed patch metadata, and CodeView only when several files or diffs need coordinated navigation.",
      "Choose split layout for careful side-by-side review when width allows; choose unified layout when space is tight, changes are mostly additive, or mobile readability matters."
    ],
    structure: [
      "Place the path, language, and reason to inspect the code immediately before each rendered file or diff.",
      "Keep evidence close to each claim with file paths, line references, or annotations next to the relevant code.",
      "For multi-file changes, group files by user-facing area or task instead of dumping a raw patch in repository order."
    ],
    design_rules: [
      `Rendering MUST use @pierre/diffs, not hand-rolled <pre> blocks or another diff library. This verified no-build standalone HTML snippet renders one file and one split diff from esm.sh:
\`\`\`html
<div id="file"></div>
<div id="diff"></div>
<script type="module">
  import { File, FileDiff } from "https://esm.sh/@pierre/diffs@1.2.10?bundle";

  const theme = { light: "github-light", dark: "github-dark" };
  const options = { theme, themeType: "dark", overflow: "wrap" };
  const oldFile = {
    name: "src/greeting.ts",
    contents: "export function greet(name: string) {\\n  return \\"Hello \\" + name;\\n}\\n\\nconsole.log(greet(\\"Lavish\\"));\\n",
  };
  const newFile = {
    name: "src/greeting.ts",
    contents: "export function greet(name: string) {\\n  return \\"Hello, \\" + name + \\"!\\";\\n}\\n\\nconsole.log(greet(\\"Lavish\\"));\\n",
  };

  new File(options).render({
    containerWrapper: document.querySelector("#file"),
    file: newFile,
  });

  new FileDiff({ ...options, diffStyle: "split" }).render({
    containerWrapper: document.querySelector("#diff"),
    oldFile,
    newFile,
  });

</script>
\`\`\``,
      "Pick a Shiki theme pair that matches the artifact's DaisyUI or Tailwind direction and light or dark mode; replace the GitHub pair above when the page is not GitHub-like.",
      'Use FileDiff diffStyle: "split" for side-by-side review and diffStyle: "unified" for stacked reading; keep overflow: "wrap" unless horizontal alignment is essential.',
      "Use @pierre/diffs line annotations, selections, and headers when calling out specific lines so notes stay attached to code."
    ],
    pitfalls: [
      "Do not render code as static screenshots, plain <pre> blocks, or markdown pasted into HTML.",
      "Do not choose an arbitrary default Shiki theme that clashes with the page palette or dark mode.",
      "Do not show huge unrelated files when a focused render range, parsed patch file, or grouped summary would be clearer.",
      "Do not separate a claim from the code lines that prove it."
    ],
    lavish_notes: [
      "A Lavish code artifact should make each file, hunk, and relevant line easy to annotate precisely.",
      "When a user action should trigger a fix, queue prompts that name the file path, line range, and desired change.",
      "If the artifact combines code with a plan, table, or comparison, read those playbooks too and keep @pierre/diffs responsible for the code surface."
    ]
  },
  {
    id: "input",
    use_when: "Must be used when the agent needs to collect user input on decisions, choices, preferences, triage, scope, or other structured feedback from within the artifact",
    choose: [
      "Use this when the user needs to select, tune, triage, annotate, or edit a structured choice.",
      "Use controls for decisions the user can make faster visually than by writing a prompt.",
      "Use plain annotations when the artifact only needs open-ended feedback."
    ],
    structure: [
      "Make each decision surface visible: what is being chosen, what the options mean, and what happens next.",
      "Keep reversible selection state local in the artifact until the user explicitly submits that question.",
      "Pair each question with a Submit or Queue answer control that sends exactly one prompt for the final answer.",
      "Show selected state separately from queued state so the user trusts what will be sent back."
    ],
    design_rules: [
      "Native form controls - radios, checkboxes, text inputs, selects, textareas, buttons, options, labels, and contenteditable regions - are interactive automatically: clicks toggle, focus, and type instead of annotating, so they do not need data-lavish-action. Build choice and option UIs from these whenever you can.",
      "For reversible choices, do not call window.lavish.queuePrompt() from radio change handlers or option click handlers. Those handlers should only update local selected state.",
      "Use a per-question form submit or explicit Queue answer button to read the current values and call window.lavish.queuePrompt() exactly once for the final answer.",
      "Put data-lavish-action only on custom (non-native) elements that should act like a feedback control - typically a styled div or span you made clickable - so Lavish does not annotate it and shows a pointer cursor instead.",
      "Use data-lavish-question on a question wrapper or pass queueKey when multiple pre-send updates should replace the prior unsent answer for the same question.",
      "Pass options such as tag, text, selector, target, data, queueKey, or element when they help the agent understand exactly what the user chose.",
      "Call window.lavish.sendQueuedPrompts() only when the control should immediately send committed feedback instead of waiting for the user to press Send to Agent.",
      "Make queued prompts specific enough that the agent can act without asking a follow-up question.",
      "Keep native browser controls accessible and readable on mobile."
    ],
    pitfalls: [
      "Do not queue one prompt per radio change, checkbox toggle, dropdown change, or choice-button click when the user can still change their mind.",
      "Do not create controls whose queued prompt is unclear or too vague to execute.",
      "Do not hide the difference between selected locally and queued for the agent.",
      "Do not require interaction for content the user only needs to read."
    ],
    lavish_notes: [
      "Lavish is strongest when the artifact becomes a focused review surface and not just a static page.",
      `A native single-choice question should submit the final value: \`<form data-lavish-question="plan" onsubmit="event.preventDefault(); const choice = new FormData(event.currentTarget).get('plan'); if (choice) window.lavish.queuePrompt('Use the ' + choice + ' plan', { tag: 'choice', text: 'Plan: ' + choice, element: event.currentTarget, data: { question: 'plan', answer: choice } });"><label><input type="radio" name="plan" value="Starter"> Starter</label><label><input type="radio" name="plan" value="Pro"> Pro</label><button type="submit">Queue this answer</button></form>\`.`,
      "A custom choice UI should make option buttons update local state, then use a separate Queue answer button with data-lavish-action to queue the final selected value.",
      "Use window.lavish.queuePrompt for user intent, not internal analytics or UI-only state changes.",
      "End input paths with an obvious way for the user to send feedback back to the agent."
    ]
  },
  {
    id: "slides",
    use_when: "Create a deliberate presentation when slides are requested",
    choose: [
      "Use slides only when the user asks for a deck, presentation, talk, or paced walkthrough.",
      "Use a scroll page when the user needs reference material, detailed review, or dense evidence.",
      "Use one idea per slide when the artifact has a narrative arc."
    ],
    structure: [
      "Plan the story before writing the slide markup.",
      "Open with the point, build context, show evidence, and close with the decision or next action.",
      "Vary slide composition so the deck does not feel like repeated cards."
    ],
    design_rules: [
      "Keep slide text sparse and let visuals carry the explanation.",
      "Use large type, strong alignment, and deliberate whitespace rather than dense paragraphs.",
      "Make navigation and screen-size assumptions explicit in the artifact."
    ],
    pitfalls: [
      "Do not turn every explainer into slides by default.",
      "Do not paste a scroll-page outline into fixed-size frames without rewriting the narrative.",
      "Do not make consecutive slides with the same spatial composition unless repetition is the point."
    ],
    lavish_notes: [
      "A Lavish slide deck can still collect feedback, but each prompt should refer to a slide or decision.",
      "Use slides for persuasion or presentation, not for dense code review."
    ]
  }
];
function listPlaybooks() {
  return PLAYBOOKS.map(({ id, use_when }) => ({ id, use_when }));
}
function findPlaybook(id) {
  return PLAYBOOKS.find((playbook) => playbook.id === id) || null;
}
function playbookIds() {
  return PLAYBOOKS.map((playbook) => playbook.id);
}

// src/server.js
import { EventEmitter } from "node:events";
import { readFile as readFile2 } from "node:fs/promises";
import { homedir } from "node:os";
import path3 from "node:path";
import chokidar from "chokidar";
import express from "express";

// src/artifact-sdk.js
function deriveLavishQueueKey(element, options = {}) {
  function stringValue(value) {
    return value === null || value === void 0 ? "" : String(value);
  }
  function attributeValue(el, name) {
    if (!el) return "";
    if (el.getAttribute) {
      const value = el.getAttribute(name);
      if (value !== null && value !== void 0) return value;
    }
    return el[name] || "";
  }
  function tagName(el) {
    return stringValue(el?.tagName || el?.nodeName).toLowerCase();
  }
  function closestElementMatching(el, selector) {
    return el && el.closest ? el.closest(selector) : null;
  }
  function elementPath(el) {
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && parts.length < 6) {
      let part = tagName(node) || "element";
      const id = stringValue(attributeValue(node, "id") || node.id).trim();
      if (id) {
        part += `#${id}`;
        parts.unshift(part);
        break;
      }
      const parent2 = node.parentElement;
      if (parent2 && parent2.children) {
        const siblings = [...parent2.children].filter((child) => tagName(child) === tagName(node));
        if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(node) + 1})`;
      }
      parts.unshift(part);
      node = parent2;
    }
    return parts.join(" > ");
  }
  function scopeKey(el) {
    const scope2 = closestElementMatching(el, "form,fieldset") || el?.parentElement || el;
    const tag2 = tagName(scope2) || "scope";
    const explicit = stringValue(
      attributeValue(scope2, "data-lavish-question") || attributeValue(scope2, "id") || attributeValue(scope2, "name")
    ).trim();
    if (explicit) return `${tag2}:${explicit}`;
    return elementPath(scope2) || tag2;
  }
  function controlIdentity(el) {
    const identity = stringValue(attributeValue(el, "name") || attributeValue(el, "id") || el?.name).trim();
    if (identity) return identity;
    return elementPath(el);
  }
  function isKeyedInputType(type2) {
    return !(/* @__PURE__ */ new Set(["button", "submit", "reset", "file", "image", "hidden", "radio", "checkbox"])).has(type2);
  }
  if (Object.hasOwn(options, "queueKey")) {
    return stringValue(options.queueKey).trim();
  }
  const question = closestElementMatching(element, "[data-lavish-question]");
  const questionKey = stringValue(attributeValue(question, "data-lavish-question")).trim();
  if (questionKey) return `question:${questionKey}`;
  const tag = tagName(element);
  const type = stringValue(attributeValue(element, "type") || element?.type).toLowerCase();
  const scope = scopeKey(element);
  if (tag === "input" && type === "radio") {
    const name = stringValue(attributeValue(element, "name") || element?.name).trim();
    if (name) return `radio:${scope}:${name}`;
    return "";
  }
  if (tag === "input" && type === "checkbox") {
    const identity = controlIdentity(element);
    const explicitValue = stringValue(element?.getAttribute ? element.getAttribute("value") : "").trim();
    const option = explicitValue || stringValue(attributeValue(element, "id") || elementPath(element)).trim();
    if (identity) return `checkbox:${scope}:${identity}:${option}`;
    return "";
  }
  if (tag === "select" || tag === "textarea" || tag === "input" && isKeyedInputType(type)) {
    const identity = controlIdentity(element);
    if (identity) return `field:${scope}:${identity}`;
  }
  return "";
}
function createArtifactSdk(deriveQueueKey) {
  let annotationMode = true;
  let hovered = null;
  let selected = null;
  let ignoreNextClick = false;
  let shadow = null;
  let counter = 0;
  const ids = /* @__PURE__ */ new WeakMap();
  function uid(el) {
    if (!ids.has(el)) ids.set(el, String(++counter));
    return ids.get(el);
  }
  function selector(el) {
    if (!el || !el.tagName) return "";
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && parts.length < 5) {
      let part = node.tagName.toLowerCase();
      if (node.id) {
        part += "#" + CSS.escape(node.id);
        parts.unshift(part);
        break;
      }
      const parent2 = node.parentElement;
      if (parent2) {
        const same = [...parent2.children].filter((x) => x.tagName === node.tagName);
        if (same.length > 1) part += ":nth-of-type(" + (same.indexOf(node) + 1) + ")";
      }
      parts.unshift(part);
      node = parent2;
    }
    return parts.join(" > ");
  }
  function context(el) {
    return {
      uid: uid(el),
      selector: selector(el),
      tag: (el.tagName || "").toLowerCase(),
      text: (el.innerText || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 240)
    };
  }
  function closestElement(node) {
    if (!node) return document.body;
    if (node.nodeType === 1) return node;
    return node.parentElement || document.body;
  }
  function nodePath(node, root) {
    const path5 = [];
    let current = node;
    while (current && current !== root) {
      const parentNode = current.parentNode;
      if (!parentNode) break;
      path5.unshift([...parentNode.childNodes].indexOf(current));
      current = parentNode;
    }
    return path5;
  }
  function rangeBoundary(node, offset) {
    const el = closestElement(node);
    return {
      selector: selector(el),
      path: nodePath(node, el),
      offset: Number(offset) || 0
    };
  }
  function textSelectionContext(selection) {
    if (!selection || selection.rangeCount === 0) return null;
    const range = selection.getRangeAt(0);
    const text = selection.toString().trim().replace(/\s+/g, " ");
    if (range.collapsed || !text) return null;
    const ancestor = closestElement(range.commonAncestorContainer);
    if (isLavishUi(ancestor) || isLavishAction(ancestor) || isInteractiveControl(ancestor)) return null;
    const commonAncestorSelector = selector(ancestor);
    const target = {
      type: "text-range",
      text,
      selector: commonAncestorSelector,
      commonAncestorSelector,
      start: rangeBoundary(range.startContainer, range.startOffset),
      end: rangeBoundary(range.endContainer, range.endOffset)
    };
    return {
      uid: "",
      selector: commonAncestorSelector,
      tag: "text",
      text: text.slice(0, 240),
      target,
      element: ancestor,
      range: range.cloneRange()
    };
  }
  function isLavishUi(el) {
    return !!(el && el.closest && el.closest("[data-lavish-ui]"));
  }
  function isLavishAction(el) {
    return !!(el && el.closest && el.closest("[data-lavish-action]"));
  }
  function isInteractiveControl(el) {
    return !!(el && el.closest && el.closest("button,input,select,textarea,option,optgroup,label,[contenteditable]:not([contenteditable='false'])"));
  }
  function highlightElement(el) {
    if (!el) return;
    el.style.outline = "var(--lavish-annotate-outline,2px solid #f4c95d)";
    el.style.outlineOffset = "var(--lavish-annotate-offset,2px)";
  }
  function clearHighlight(el) {
    if (el) el.style.outline = "";
  }
  function clearTextHighlight() {
    if (!shadow) return;
    for (const el of [...shadow.querySelectorAll(".lavish-text-highlight")]) el.remove();
  }
  function highlightTextRange(range) {
    clearTextHighlight();
    const root = ensureShadow();
    for (const rect of [...range.getClientRects()]) {
      if (rect.width <= 0 || rect.height <= 0) continue;
      const mark = document.createElement("div");
      mark.className = "lavish-text-highlight";
      mark.style.left = rect.left + "px";
      mark.style.top = rect.top + "px";
      mark.style.width = rect.width + "px";
      mark.style.height = rect.height + "px";
      root.appendChild(mark);
    }
  }
  function setAnnotationMode(enabled) {
    annotationMode = !!enabled;
    let style = document.getElementById("lavish-cursor-style");
    if (annotationMode && !style) {
      style = document.createElement("style");
      style.id = "lavish-cursor-style";
      style.textContent = ":root{--lavish-accent:#f4c95d;--lavish-annotate-outline:2px solid var(--lavish-accent);--lavish-annotate-offset:2px}*{cursor:default!important}[data-lavish-action],[data-lavish-action] *{cursor:pointer!important}input,textarea,[contenteditable]:not([contenteditable='false']){cursor:text!important}button,select,label,option,input[type='button'],input[type='submit'],input[type='reset'],input[type='checkbox'],input[type='radio'],input[type='file'],input[type='color'],input[type='range'],input[type='image']{cursor:pointer!important}";
      document.head.appendChild(style);
    }
    if (!annotationMode && style) style.remove();
    if (!annotationMode) closeCard();
  }
  function queuePrompt(prompt, options = {}) {
    const originElement = options.element || document.activeElement || document.body;
    const item = {
      ...context(originElement),
      prompt: String(prompt || "")
    };
    const queueKey = typeof deriveQueueKey === "function" ? deriveQueueKey(originElement, options) : "";
    if (queueKey) item._lavishQueueKey = String(queueKey);
    if (options.uid) item.uid = String(options.uid);
    if (options.selector) item.selector = String(options.selector);
    if (options.tag) item.tag = String(options.tag);
    if (options.text) item.text = String(options.text);
    if (options.target) item.target = options.target;
    if (options.data) item.prompt += "\n\nContext data:\n" + JSON.stringify(options.data, null, 2);
    parent.postMessage({ type: "lavish:queuePrompt", prompt: item }, "*");
  }
  function sendQueuedPrompts() {
    parent.postMessage({ type: "lavish:sendQueuedPrompts" }, "*");
  }
  function endSession() {
    parent.postMessage({ type: "lavish:endSession" }, "*");
  }
  function snapshot() {
    const lines = [];
    function walk(el, depth) {
      if (!(el instanceof Element) || depth > 6 || isLavishUi(el)) return;
      const c = context(el);
      const name = c.text ? ' "' + c.text.slice(0, 80).replace(/"/g, "'") + '"' : "";
      lines.push("  ".repeat(depth) + "uid=" + c.uid + " " + c.tag + name);
      for (const child of el.children) walk(child, depth + 1);
    }
    walk(document.body, 0);
    return lines.join("\n");
  }
  function ensureShadow() {
    if (shadow) return shadow;
    const host = document.createElement("div");
    host.className = "lavish-annotation-root";
    host.setAttribute("data-lavish-ui", "annotation-root");
    document.documentElement.appendChild(host);
    shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = `:host{all:initial;position:fixed;z-index:2147483647;left:0;top:0;color-scheme:dark;--ink-900:#0f1115;--ink-800:#11141a;--ink-700:#171a21;--ink-600:#1c212b;--steel-700:#2a2f3a;--steel-600:#303745;--steel-500:#3c4557;--steel-400:#8c96aa;--steel-300:#aeb6c6;--steel-200:#b9c0cf;--steel-100:#d8deea;--cream-50:#fffbf3;--cream-100:#f7f3ea;--cream-200:#e8e1cf;--brass-500:#f4c95d;--brass-400:#ffd877;--brass-ink:#17130a;--bg:var(--ink-900);--bg-panel:var(--ink-800);--bg-elevated:var(--ink-600);--fg:var(--cream-100);--fg-faint:var(--steel-300);--border:var(--steel-600);--accent:#f4c95d;--accent-hover:#ffd877;--font-sans:Geist,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;--font-mono:"Geist Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;--radius-md:10px;--radius-xl:14px;--shadow-floating:0 20px 70px rgba(0,0,0,.35);font-family:var(--font-sans)}*{box-sizing:border-box}:focus-visible{outline:2px solid var(--accent);outline-offset:2px}.lavish-text-highlight{position:fixed;pointer-events:none;background:rgba(244,201,93,.28);border-radius:2px;box-shadow:0 0 0 1px rgba(244,201,93,.45)}.lavish-annotation-card{position:fixed;width:min(320px,calc(100vw - 24px));padding:12px;border-radius:var(--radius-xl);background:var(--bg-panel);color:var(--fg);border:1px solid var(--accent);box-shadow:var(--shadow-floating);font:14px/1.4 var(--font-sans)}.lavish-heading{font-weight:700;margin-bottom:6px}.lavish-annotation-card textarea{width:100%;min-height:86px;resize:vertical;border-radius:var(--radius-md);border:1px solid var(--border);background:var(--bg);color:var(--fg);padding:9px;font:inherit;font-family:var(--font-sans)}.lavish-annotation-card textarea::placeholder{color:var(--fg-faint)}.lavish-annotation-card .lavish-hint{margin-top:6px;font-size:11px;color:var(--fg-faint)}.lavish-annotation-card .lavish-row{display:flex;gap:8px;justify-content:flex-end;margin-top:8px}.lavish-annotation-card button{border:0;border-radius:var(--radius-md);padding:8px 10px;font-family:var(--font-sans);font-size:13px;font-weight:700;cursor:pointer}.lavish-annotation-card button:active{opacity:.85}.lavish-annotation-card .lavish-send{background:var(--accent);color:var(--brass-ink)}.lavish-annotation-card .lavish-send:hover{background:var(--accent-hover)}.lavish-annotation-card .lavish-cancel{background:var(--steel-700);color:var(--fg)}`;
    shadow.appendChild(style);
    return shadow;
  }
  function closeCard() {
    if (shadow) {
      for (const el of [...shadow.querySelectorAll(".lavish-annotation-card")]) el.remove();
    }
    clearHighlight(hovered);
    clearHighlight(selected);
    hovered = null;
    clearTextHighlight();
    selected = null;
  }
  function showAnnotationCard(target, options = {}) {
    const root = ensureShadow();
    closeCard();
    const c = options.context || context(target);
    if (options.range) {
      highlightTextRange(options.range);
    } else {
      selected = target;
      highlightElement(selected);
    }
    const rect = options.range ? options.range.getBoundingClientRect() : target.getBoundingClientRect();
    const card = document.createElement("div");
    card.className = "lavish-annotation-card";
    const heading = c.tag === "text" ? "Annotate text" : "Annotate &lt;" + c.tag + "&gt;";
    const placeholder = c.tag === "text" ? "Tell the agent what to change about this text..." : "Tell the agent what to change about this element...";
    card.innerHTML = '<div class="lavish-heading">' + heading + '</div><textarea placeholder="' + placeholder + '"></textarea><div class="lavish-hint">Enter to queue &middot; ' + (/Mac|iP(hone|ad|od)/.test(navigator.platform) ? "\u2318" : "Ctrl") + '+Enter to send now</div><div class="lavish-row"><button class="lavish-cancel" type="button">Cancel</button><button class="lavish-send" type="button">Queue</button></div>';
    root.appendChild(card);
    const left = Math.min(Math.max(12, rect.left), window.innerWidth - card.offsetWidth - 12);
    const top = Math.min(Math.max(12, rect.bottom + 8), window.innerHeight - card.offsetHeight - 12);
    card.style.left = left + "px";
    card.style.top = top + "px";
    const textarea = (
      /** @type {HTMLTextAreaElement | null} */
      card.querySelector("textarea")
    );
    const cancelButton = (
      /** @type {HTMLButtonElement | null} */
      card.querySelector(".lavish-cancel")
    );
    const sendButton = (
      /** @type {HTMLButtonElement | null} */
      card.querySelector(".lavish-send")
    );
    if (!textarea || !cancelButton || !sendButton) return;
    cancelButton.onclick = closeCard;
    sendButton.onclick = () => {
      const prompt = textarea.value.trim();
      if (prompt) queuePrompt(prompt, { ...c, queueKey: "" });
      closeCard();
    };
    textarea.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        const sendNow = (event.ctrlKey || event.metaKey) && !!textarea.value.trim();
        sendButton.click();
        if (sendNow) sendQueuedPrompts();
      }
    });
    setTimeout(() => textarea.focus(), 0);
  }
  window.lavish = {
    queuePrompt,
    sendQueuedPrompts,
    endSession,
    getQueuedPrompts: () => [],
    setStatus: (message) => parent.postMessage({ type: "lavish:status", message: String(message) }, "*"),
    snapshot
  };
  window.addEventListener("message", (event) => {
    const msg = event.data || {};
    if (msg.type === "lavish:setAnnotationMode") setAnnotationMode(msg.enabled);
    if (msg.type === "lavish:requestSnapshot") {
      parent.postMessage({ type: "lavish:snapshot", snapshot: snapshot() }, "*");
    }
    if (msg.type === "lavish:restoreScroll") {
      window.scrollTo(Number(msg.x) || 0, Number(msg.y) || 0);
    }
  });
  let scrollFrame = 0;
  window.addEventListener(
    "scroll",
    () => {
      if (scrollFrame) return;
      scrollFrame = window.requestAnimationFrame(() => {
        scrollFrame = 0;
        parent.postMessage({ type: "lavish:scroll", x: window.scrollX, y: window.scrollY }, "*");
      });
    },
    { passive: true }
  );
  document.addEventListener(
    "mouseover",
    (event) => {
      if (!annotationMode || isLavishUi(event.target) || isLavishAction(event.target) || isInteractiveControl(event.target))
        return;
      if (event.target === selected) return;
      if (hovered && hovered !== selected) clearHighlight(hovered);
      hovered = event.target;
      highlightElement(hovered);
    },
    true
  );
  document.addEventListener(
    "mouseout",
    () => {
      if (hovered && hovered !== selected) {
        clearHighlight(hovered);
        hovered = null;
      }
    },
    true
  );
  document.addEventListener(
    "mouseup",
    (event) => {
      if (!annotationMode || isLavishUi(event.target) || isLavishAction(event.target) || isInteractiveControl(event.target))
        return;
      const c = textSelectionContext(document.getSelection());
      if (!c) return;
      ignoreNextClick = true;
      showAnnotationCard(c.element, { context: c, range: c.range });
    },
    true
  );
  document.addEventListener(
    "click",
    (event) => {
      if (!annotationMode || isLavishUi(event.target) || isLavishAction(event.target) || isInteractiveControl(event.target))
        return;
      event.preventDefault();
      event.stopPropagation();
      if (ignoreNextClick) {
        ignoreNextClick = false;
        return;
      }
      showAnnotationCard(event.target);
    },
    true
  );
  setAnnotationMode(annotationMode);
}

// src/html-transform.js
function injectLavishSdk(html, key) {
  const script = `<script src="/sdk.js?key=${encodeURIComponent(key)}"></script>`;
  if (/<\/body\s*>/i.test(html)) {
    return html.replace(/<\/body\s*>/i, `${script}</body>`);
  }
  return `${html}
${script}`;
}

// src/session-store.js
import crypto from "node:crypto";
import { readFile, realpath, writeFile } from "node:fs/promises";
import path2 from "node:path";
var SessionStore = class {
  constructor(file) {
    this.file = file;
  }
  async listSessions() {
    const state = await this.readState();
    return Object.values(state.sessions).sort((a, b) => a.file.localeCompare(b.file));
  }
  async findByFile(file) {
    const absolute = await canonicalFile(file);
    const state = await this.readState();
    return state.sessions[sessionKey(absolute)] || null;
  }
  async findByKey(key) {
    const state = await this.readState();
    return state.sessions[key] || null;
  }
  async upsertSession(file, url) {
    const absolute = await canonicalFile(file);
    const key = sessionKey(absolute);
    const state = await this.readState();
    const existing = state.sessions[key] || {};
    const session = {
      key,
      file: absolute,
      url,
      status: existing.status === "ended" ? "open" : existing.status || "open",
      pending_prompts: existing.pending_prompts || 0,
      prompts: existing.prompts || [],
      dom_snapshot: existing.dom_snapshot || "",
      chat: existing.chat || [],
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    state.sessions[key] = session;
    await this.writeState(state);
    return session;
  }
  async queuePrompts(key, payload) {
    const state = await this.readState();
    const session = state.sessions[key];
    if (!session) {
      return null;
    }
    const prompts = Array.isArray(payload.prompts) ? payload.prompts : [];
    const normalizedPrompts = prompts.map(normalizePrompt);
    const userMessages = normalizedPrompts.filter((prompt) => prompt.tag === "message" && prompt.prompt).map((prompt) => ({ role: "user", text: prompt.prompt, at: (/* @__PURE__ */ new Date()).toISOString() }));
    session.prompts = [...session.prompts || [], ...normalizedPrompts];
    session.chat = [...session.chat || [], ...userMessages];
    session.pending_prompts = session.prompts.length;
    session.dom_snapshot = String(payload.domSnapshot || payload.dom_snapshot || "");
    session.status = "feedback";
    session.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    await this.writeState(state);
    return session;
  }
  async takeFeedback(key) {
    const state = await this.readState();
    const session = state.sessions[key];
    if (!session) {
      return { status: "missing" };
    }
    const prompts = session.prompts || [];
    if (prompts.length === 0) {
      return session.status === "ended" ? { status: "ended" } : { status: "waiting" };
    }
    const result = {
      status: "feedback",
      dom_snapshot: session.dom_snapshot || "",
      prompts
    };
    session.prompts = [];
    session.pending_prompts = 0;
    session.dom_snapshot = "";
    if (session.status !== "ended") {
      session.status = "open";
    }
    session.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    await this.writeState(state);
    return result;
  }
  async endSession(key) {
    const state = await this.readState();
    const session = state.sessions[key];
    if (!session) {
      return null;
    }
    session.status = "ended";
    session.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    await this.writeState(state);
    return session;
  }
  async addAgentReply(key, text) {
    const state = await this.readState();
    const session = state.sessions[key];
    if (!session) {
      return null;
    }
    session.chat = [...session.chat || [], { role: "agent", text: String(text || ""), at: (/* @__PURE__ */ new Date()).toISOString() }];
    session.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    await this.writeState(state);
    return session;
  }
  async readState() {
    try {
      const raw = await readFile(this.file, "utf8");
      const parsed = JSON.parse(raw);
      return { sessions: parsed.sessions || {} };
    } catch (error) {
      if (error && error.code === "ENOENT") {
        return { sessions: {} };
      }
      throw error;
    }
  }
  async writeState(state) {
    await writeFile(this.file, `${JSON.stringify(state, null, 2)}
`);
  }
};
async function canonicalFile(file) {
  const absolute = path2.resolve(file);
  return realpath(absolute);
}
function sessionKey(file) {
  return crypto.createHash("sha256").update(file).digest("hex").slice(0, 16);
}
function normalizePrompt(prompt) {
  const normalized = {
    uid: String(prompt.uid || ""),
    prompt: String(prompt.prompt || ""),
    selector: String(prompt.selector || ""),
    tag: String(prompt.tag || ""),
    text: String(prompt.text || "")
  };
  const target = normalizeTarget(prompt.target);
  if (target) normalized.target = target;
  return normalized;
}
function normalizeTarget(target) {
  if (!target || typeof target !== "object" || Array.isArray(target)) return null;
  return JSON.parse(JSON.stringify(target));
}

// src/server.js
var chromeClientUrl = new URL("./chrome-client.js", import.meta.url);
var chromeCssUrl = new URL("./chrome.css", import.meta.url);
var designAssetUrls = {
  "daisyui.css": {
    packaged: new URL("./design/daisyui.css", import.meta.url),
    source: new URL("../node_modules/daisyui/daisyui.css", import.meta.url),
    type: "text/css"
  },
  "daisyui-themes.css": {
    packaged: new URL("./design/daisyui-themes.css", import.meta.url),
    source: new URL("../node_modules/daisyui/themes.css", import.meta.url),
    type: "text/css"
  },
  "tailwindcss-browser.js": {
    packaged: new URL("./design/tailwindcss-browser.js", import.meta.url),
    source: new URL("../node_modules/@tailwindcss/browser/dist/index.global.js", import.meta.url),
    type: "application/javascript"
  }
};
var DEFAULT_IDLE_TIMEOUT_MS = 30 * 6e4;
function resolveIdleTimeoutMs(env = process.env) {
  const raw = env.LAVISH_AXI_IDLE_TIMEOUT_MS?.trim();
  if (raw === void 0 || raw === "") return DEFAULT_IDLE_TIMEOUT_MS;
  if (raw === "0" || raw.toLowerCase() === "off") return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_IDLE_TIMEOUT_MS;
  return value;
}
async function serve({
  port,
  stateFile: stateFile2,
  version = "",
  debug = false,
  log = null,
  pollHeartbeatMs = 15e3,
  idleTimeoutMs = resolveIdleTimeoutMs(),
  host = bindHost(),
  linkHost: linkHostName = linkHost()
}) {
  const app = express();
  const store = new SessionStore(stateFile2);
  const events = new EventEmitter();
  const watchers = /* @__PURE__ */ new Map();
  const activePolls = /* @__PURE__ */ new Map();
  const deliveredFeedback = /* @__PURE__ */ new Set();
  const sseClients = /* @__PURE__ */ new Set();
  const verbose = debug || process.env.LAVISH_AXI_DEBUG === "1";
  const writeLog = typeof log === "function" ? log : (line) => process.stderr.write(`${line}
`);
  const logEvent = verbose ? (line) => writeLog(`[lavish] ${line}`) : null;
  let publicPort = port;
  app.use(express.json({ limit: "2mb" }));
  app.get("/health", (req, res) => {
    res.json({ ok: true, app: "lavish-axi", version });
  });
  let shutdownResolve;
  const done = new Promise((resolve) => {
    shutdownResolve = resolve;
  });
  app.post("/shutdown", (req, res) => {
    res.json({ status: "shutting-down" });
    setImmediate(shutdown);
  });
  app.post("/api/sessions", async (req, res, next) => {
    try {
      const file = await canonicalFile(req.body.file);
      const key = sessionKey(file);
      const url = `http://${hostForUrl(linkHostName)}:${publicPort}/session/${key}`;
      const existing = await store.findByKey(key);
      const session = await store.upsertSession(file, url);
      if (existing?.status === "ended") {
        clearFeedbackDelivery(key, activePolls, deliveredFeedback, events);
      }
      logEvent?.(`session opened key=${key} file=${file}`);
      await watchSession(session, watchers, events, logEvent);
      res.json({ key, file, url, status: "opened" });
    } catch (error) {
      next(error);
    }
  });
  app.get("/api/poll", async (req, res, next) => {
    try {
      let handleRespondError = function(error) {
        if (streamHeartbeat) {
          cleanup();
          if (!res.writableEnded) res.destroy(error);
          return;
        }
        next(error);
      };
      const file = await canonicalFile(String(req.query.file || ""));
      const key = sessionKey(file);
      const timeoutMs = req.query.timeoutMs === void 0 ? null : Math.max(0, Math.min(Number(req.query.timeoutMs || 0), 2147483647));
      const immediate = await store.takeFeedback(key);
      if (immediate.status !== "waiting") {
        if (immediate.status === "feedback") markFeedbackDelivered(key, activePolls, deliveredFeedback, events);
        res.json(immediate);
        return;
      }
      const streamHeartbeat = timeoutMs === null;
      let heartbeat = null;
      if (streamHeartbeat) {
        res.status(200).type("application/json");
        res.write(" ");
        heartbeat = setInterval(() => {
          if (!res.writableEnded) res.write(" ");
        }, pollHeartbeatMs);
        heartbeat.unref?.();
      }
      setPollActive(key, activePolls, deliveredFeedback, events, true);
      refreshIdleTimer();
      const timer = timeoutMs === null ? null : setTimeout(() => respond().catch(handleRespondError), timeoutMs);
      let cleaned = false;
      let responding = false;
      const cleanup = () => {
        if (cleaned) return;
        cleaned = true;
        if (timer) clearTimeout(timer);
        if (heartbeat) clearInterval(heartbeat);
        events.off("feedback", onFeedback);
        events.off("ended", onFeedback);
        setPollActive(key, activePolls, deliveredFeedback, events, false);
        refreshIdleTimer();
      };
      const respond = async () => {
        if (responding || res.writableEnded) return;
        responding = true;
        try {
          const result = await store.takeFeedback(key);
          if (result.status === "feedback") markFeedbackDelivered(key, activePolls, deliveredFeedback, events);
          if (streamHeartbeat) {
            res.end(JSON.stringify(result));
          } else {
            res.json(result);
          }
        } finally {
          cleanup();
        }
      };
      const onFeedback = (changedKey) => {
        if (changedKey !== key || res.writableEnded) {
          return;
        }
        respond().catch(handleRespondError);
      };
      events.on("feedback", onFeedback);
      events.on("ended", onFeedback);
      req.on("close", cleanup);
    } catch (error) {
      next(error);
    }
  });
  app.post("/api/:key/prompts", async (req, res, next) => {
    try {
      const session = await store.queuePrompts(req.params.key, req.body || {});
      if (!session) {
        res.status(404).json({ error: "session not found" });
        return;
      }
      events.emit("feedback", req.params.key);
      res.json({ status: "queued", pending_prompts: session.pending_prompts });
    } catch (error) {
      next(error);
    }
  });
  app.post("/api/:key/end", async (req, res, next) => {
    try {
      await store.endSession(req.params.key);
      clearFeedbackDelivery(req.params.key, activePolls, deliveredFeedback, events);
      events.emit("ended", req.params.key);
      res.json({ status: "ended" });
      await shutdownIfNoLiveSessions();
    } catch (error) {
      next(error);
    }
  });
  app.post("/api/:key/agent-reply", async (req, res, next) => {
    try {
      const text = String(req.body?.text || "");
      const session = await store.addAgentReply(req.params.key, text);
      if (!session) {
        res.status(404).json({ error: "session not found" });
        return;
      }
      events.emit("agent-reply", req.params.key, text);
      res.json({ status: "sent" });
    } catch (error) {
      next(error);
    }
  });
  app.post("/api/end", async (req, res, next) => {
    try {
      const file = await canonicalFile(req.body.file);
      const key = sessionKey(file);
      await store.endSession(key);
      clearFeedbackDelivery(key, activePolls, deliveredFeedback, events);
      events.emit("ended", key);
      res.json({ status: "ended" });
      await shutdownIfNoLiveSessions();
    } catch (error) {
      next(error);
    }
  });
  app.get("/session/:key", async (req, res, next) => {
    try {
      const session = await store.findByKey(req.params.key);
      if (!session) {
        res.status(404).send("Session not found");
        return;
      }
      await watchSession(session, watchers, events, logEvent);
      res.type("html").send(createChromeHtml(session));
    } catch (error) {
      next(error);
    }
  });
  app.get("/artifact/:key", (req, res) => {
    res.redirect(`/artifact/${req.params.key}/index.html`);
  });
  app.get(/^\/artifact\/([^/]+)\/index\.html$/, async (req, res, next) => {
    try {
      const key = req.params[0];
      const session = await store.findByKey(key);
      if (!session) {
        res.status(404).send("Session not found");
        return;
      }
      const html = await readFile2(session.file, "utf8");
      res.type("html").send(injectLavishSdk(html, key));
    } catch (error) {
      next(error);
    }
  });
  app.get(/^\/artifact\/([^/]+)\/(.+)$/, async (req, res, next) => {
    try {
      const key = req.params[0];
      const assetPath = req.params[1];
      const session = await store.findByKey(key);
      if (!session) {
        res.status(404).send("Session not found");
        return;
      }
      const root = path3.dirname(session.file);
      const file = resolveArtifactAsset(root, assetPath);
      if (!file) {
        res.status(403).send("Forbidden");
        return;
      }
      res.sendFile(file, { dotfiles: "allow" });
    } catch (error) {
      next(error);
    }
  });
  app.get("/events/:key", async (req, res, next) => {
    try {
      res.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive"
      });
      sseClients.add(res);
      refreshIdleTimer();
      const session = await store.findByKey(req.params.key);
      const sendReload = (key) => {
        if (key === req.params.key) {
          res.write("event: reload\ndata: {}\n\n");
        }
      };
      const sendAgentReply = (key, text) => {
        if (key === req.params.key) {
          res.write(`event: agent-reply
data: ${JSON.stringify({ text })}

`);
        }
      };
      const sendPresence = (key, state) => {
        if (key === req.params.key) {
          res.write(`event: agent-presence
data: ${JSON.stringify({ state })}

`);
        }
      };
      res.write(`event: chat-sync
data: ${JSON.stringify({ chat: session?.chat || [] })}

`);
      res.write(
        `event: agent-presence
data: ${JSON.stringify({ state: computePresence(req.params.key, activePolls, deliveredFeedback) })}

`
      );
      events.on("reload", sendReload);
      events.on("agent-reply", sendAgentReply);
      events.on("agent-presence", sendPresence);
      req.on("close", () => {
        sseClients.delete(res);
        events.off("reload", sendReload);
        events.off("agent-reply", sendAgentReply);
        events.off("agent-presence", sendPresence);
        refreshIdleTimer();
      });
    } catch (error) {
      next(error);
    }
  });
  app.get("/chrome-client.js", async (req, res, next) => {
    try {
      res.type("application/javascript").send(await readFile2(chromeClientUrl, "utf8"));
    } catch (error) {
      next(error);
    }
  });
  app.get("/chrome.css", async (req, res, next) => {
    try {
      res.type("text/css").send(await readFile2(chromeCssUrl, "utf8"));
    } catch (error) {
      next(error);
    }
  });
  app.get("/design/:asset", async (req, res, next) => {
    try {
      const asset = designAssetUrls[req.params.asset];
      if (!asset) {
        res.status(404).send("Not found");
        return;
      }
      res.type(asset.type).send(await readDesignAsset(asset));
    } catch (error) {
      next(error);
    }
  });
  app.get("/sdk.js", (req, res) => {
    res.type("application/javascript").send(createSdkJs(String(req.query.key || "")));
  });
  app.use((error, req, res, _next) => {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  });
  const httpServer = await new Promise((resolve, reject) => {
    const s = app.listen(port, host, () => {
      if (s.address()) resolve(s);
    });
    s.once("error", reject);
  });
  publicPort = httpServer.address().port;
  let shuttingDown = false;
  function shutdown() {
    if (shuttingDown) return;
    shuttingDown = true;
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
    for (const res of sseClients) {
      try {
        res.write("event: chrome-reload\ndata: {}\n\n");
        res.end();
      } catch {
      }
    }
    sseClients.clear();
    for (const w of watchers.values()) {
      w.close().catch(() => {
      });
    }
    watchers.clear();
    httpServer.close(() => shutdownResolve());
    if (typeof httpServer.closeAllConnections === "function") {
      httpServer.closeAllConnections();
    }
  }
  let idleTimer = null;
  function refreshIdleTimer() {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
    if (shuttingDown || idleTimeoutMs == null) return;
    if (sseClients.size > 0 || activePolls.size > 0) return;
    idleTimer = setTimeout(() => {
      idleTimer = null;
      if (!shuttingDown && sseClients.size === 0 && activePolls.size === 0) {
        logEvent?.(`idle for ${idleTimeoutMs}ms with no connections, shutting down`);
        shutdown();
      }
    }, idleTimeoutMs);
    idleTimer.unref?.();
  }
  async function shutdownIfNoLiveSessions() {
    if (sseClients.size > 0 || activePolls.size > 0) return;
    try {
      const sessions = await store.listSessions();
      if (sessions.every((session) => session.status === "ended")) {
        logEvent?.("last open session ended with no live connections, shutting down");
        setImmediate(shutdown);
      }
    } catch {
    }
  }
  refreshIdleTimer();
  return {
    port: httpServer.address().port,
    close: async () => {
      shutdown();
      await done;
    },
    done
  };
}
async function readDesignAsset(asset) {
  try {
    return await readFile2(asset.packaged, "utf8");
  } catch (error) {
    if (error && error.code !== "ENOENT") throw error;
    return readFile2(asset.source, "utf8");
  }
}
function resolveArtifactAsset(root, assetPath) {
  const file = path3.resolve(root, assetPath);
  const relative = path3.relative(root, file);
  if (relative.startsWith("..") || path3.isAbsolute(relative)) {
    return null;
  }
  return file;
}
async function watchSession(session, watchers, events, logEvent) {
  if (watchers.has(session.key)) {
    return;
  }
  const target = await resolveWatchTarget(session);
  if (watchers.has(session.key)) {
    return;
  }
  logEvent?.(`watch session=${session.key} scope=${target.scope} path=${target.path}`);
  const watcher = chokidar.watch(target.path, target.options);
  let timer = null;
  watcher.on("all", (event, file) => {
    logEvent?.(`watch event=${event} session=${session.key} file=${file ?? ""}`);
    clearTimeout(timer);
    timer = setTimeout(() => events.emit("reload", session.key), 100);
  });
  watcher.on("error", (error) => {
    const message = error instanceof Error ? error.message : String(error);
    logEvent?.(`watch error session=${session.key} message=${message}`);
  });
  watchers.set(session.key, watcher);
}
async function resolveWatchTarget(session) {
  const baseOptions = {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 }
  };
  try {
    const html = await readFile2(session.file, "utf8");
    if (hasLiveReloadRootOptIn(html)) {
      return {
        path: path3.dirname(session.file),
        scope: "directory",
        options: {
          ...baseOptions,
          ignored: /(^|[/\\])(\.git|node_modules|dist|build|\.lavish-axi)([/\\]|$)/
        }
      };
    }
  } catch {
  }
  return { path: session.file, scope: "file", options: baseOptions };
}
function hasLiveReloadRootOptIn(html) {
  if (typeof html !== "string") return false;
  const searchableHtml = html.replace(/<!--[\s\S]*?-->/g, "");
  if (/<html\b[^>]*\sdata-lavish-live-reload-root(?:[\s=>/]|$)[^>]*>/i.test(searchableHtml)) return true;
  return /<meta\b(?=[^>]*name=["']lavish-live-reload["'])(?=[^>]*content=["']root["'])[^>]*>/i.test(searchableHtml);
}
function setPollActive(key, activePolls, deliveredFeedback, events, active) {
  const previousPresence = computePresence(key, activePolls, deliveredFeedback);
  const count = activePolls.get(key) || 0;
  const nextCount = active ? count + 1 : Math.max(0, count - 1);
  if (nextCount === count) return;
  if (nextCount === 0) {
    activePolls.delete(key);
  } else {
    activePolls.set(key, nextCount);
    deliveredFeedback.delete(key);
  }
  const nextPresence = computePresence(key, activePolls, deliveredFeedback);
  if (nextPresence !== previousPresence) events.emit("agent-presence", key, nextPresence);
}
function markFeedbackDelivered(key, activePolls, deliveredFeedback, events) {
  const previousPresence = computePresence(key, activePolls, deliveredFeedback);
  deliveredFeedback.add(key);
  const nextPresence = computePresence(key, activePolls, deliveredFeedback);
  if (nextPresence !== previousPresence) {
    events.emit("agent-presence", key, nextPresence);
  }
}
function clearFeedbackDelivery(key, activePolls, deliveredFeedback, events) {
  const previousPresence = computePresence(key, activePolls, deliveredFeedback);
  deliveredFeedback.delete(key);
  const nextPresence = computePresence(key, activePolls, deliveredFeedback);
  if (nextPresence !== previousPresence) {
    events.emit("agent-presence", key, nextPresence);
  }
}
function computePresence(key, activePolls, deliveredFeedback) {
  if (activePolls.has(key)) return "listening";
  if (deliveredFeedback.has(key)) return "working";
  return "waiting";
}
function chromeIcon(paths, size = 16, strokeWidth = 1.7) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}
var chromeIcons = {
  more: chromeIcon(
    '<circle cx="12" cy="5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="19" r="1.4"/>'
  ),
  file: chromeIcon(
    '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
    13
  ),
  copy: chromeIcon(
    '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    12
  ),
  check: chromeIcon('<polyline points="20 6 9 17 4 12"/>', 12),
  refresh: chromeIcon(
    '<path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/>',
    15
  ),
  camera: chromeIcon(
    '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/>',
    15
  ),
  exit: chromeIcon(
    '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
    15
  ),
  send: chromeIcon('<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4Z"/>', 14),
  caret: chromeIcon('<path d="m6 9 6 6 6-6"/>', 13, 2)
};
function displayPathParts(file, home = homedir()) {
  const normalizedFile = file.replaceAll("\\", "/");
  const normalizedHome = home.replaceAll("\\", "/");
  const display = normalizedHome && normalizedFile.startsWith(`${normalizedHome}/`) ? `~/${normalizedFile.slice(normalizedHome.length + 1)}` : normalizedFile;
  const tailStart = display.lastIndexOf("/") + 1;
  return { head: display.slice(0, tailStart), tail: display.slice(tailStart) };
}
function createChromeHtml(session) {
  const sessionJson = jsonScript({ key: session.key, file: session.file, initialChat: session.chat || [] });
  const { head: pathHead, tail: pathTail } = displayPathParts(session.file);
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Lavish Editor</title>
<link rel="stylesheet" href="/chrome.css">
</head>
<body class="lavish">
<div class="bar"><div class="brand"><span class="brand-mark">Lavish</span><span class="brand-support">Editor</span></div><div class="spacer" aria-hidden="true"></div><button class="annotate-switch" id="annotation" type="button" aria-pressed="true"><span class="switch-track" aria-hidden="true"><span class="switch-knob"></span></span><span>Annotate</span></button><div class="more-wrap" id="moreWrap"><button class="more-button" id="moreButton" type="button" title="More" aria-haspopup="menu" aria-expanded="false">${chromeIcons.more}</button><div class="menu more-menu" id="moreMenu" hidden><div class="menu-head"><div class="menu-label">Editing</div><button class="menu-file" id="copyPath" type="button" title="Copy path \xB7 ${escapeHtml(session.file)}">${chromeIcons.file}<span class="menu-file-text"><span class="path-head">${escapeHtml(pathHead)}</span><span class="path-tail">${escapeHtml(pathTail)}</span></span><span class="copy-hint" id="copyHint"><span class="icon-copy">${chromeIcons.copy}</span><span class="icon-check">${chromeIcons.check}</span><span id="copyHintText">Copy</span></span></button></div><div class="menu-rule"></div><button class="menu-item" id="reloadArtifact" type="button">${chromeIcons.refresh}<span>Reload artifact</span></button><button class="menu-item" id="copySnapshot" type="button">${chromeIcons.camera}<span>Copy DOM snapshot</span></button><div class="menu-rule"></div><button class="menu-item danger" id="end" type="button">${chromeIcons.exit}<span>End session</span></button></div></div></div>
<div class="layout"><div class="frame"><iframe id="artifact" sandbox="allow-scripts allow-forms allow-popups allow-downloads" src="/artifact/${session.key}/index.html"></iframe></div><aside class="panel"><h2>Conversation</h2><div class="chat" id="chatLog"></div><div class="composer"><div class="presence-banner" id="presenceBanner" hidden>Your agent is not listening. If this persists, ask your agent to poll for updates from Lavish.</div><div class="annotation-pills" id="annotationPills"></div><textarea id="chatInput" placeholder="Write a message for the agent..."></textarea><div class="actions" id="sendActions"><span class="send-hint" id="sendHint" hidden>Write a message or annotate an element first.</span><div class="split"><button class="button send-main" id="send">Send to Agent</button><button class="button send-caret" id="sendCaret" type="button" title="Send options" aria-haspopup="menu" aria-expanded="false">${chromeIcons.caret}</button></div><div class="menu send-menu" id="sendMenu" hidden><button class="menu-item" id="sendFromMenu" type="button">${chromeIcons.send}<span>Send to Agent</span></button><button class="menu-item danger" id="sendAndEnd" type="button">${chromeIcons.exit}<span>Send &amp; end session</span></button></div></div></div></aside></div>
<div class="ended-overlay" id="endedOverlay" hidden><div class="ended-card"><div class="ended-title">Session ended.<br>Return to your agent to continue.</div><p class="ended-copy">${escapeHtml(session.file)}</p></div></div>
<script id="lavish-session" type="application/json">${sessionJson}</script>
<script src="/chrome-client.js"></script>
</body>
</html>`;
}
function createSdkJs(key) {
  return `(() => {
const key=${JSON.stringify(key)};
void key;
const deriveQueueKey=${deriveLavishQueueKey.toString()};
(${createArtifactSdk.toString()})(deriveQueueKey);
})();`;
}
function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]
  );
}
function jsonScript(value) {
  return JSON.stringify(value).replace(/&/g, "\\u0026").replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

// src/telemetry.js
// LOCAL-AXI PATCH (telemetry removed): upstream lavish-axi shipped an opt-out
// Umami analytics beacon to https://a.kunchenguid.com (POST /api/send) that
// fired by default. This vendored copy HARD-DISABLES it unconditionally:
// resolveTelemetryConfig always returns disabled, the build-time host/website
// IDs are emptied, and the fallback host is blanked. No env var can re-enable
// it. Net effect: createTelemetryClient() always returns a NoopTelemetryClient.
var HARDCODED_FALLBACK_HOST = "";
var UMAMI_PATH = "/api/send";
var DEFAULT_HOSTNAME = "cli";
var DEFAULT_TITLE = "Lavish Editor CLI";
var DEFAULT_REQUEST_TIMEOUT_MS = 1e3;
function resolveTelemetryConfig(input) {
  return { enabled: false, host: "", websiteID: "" };
}
function getBuildTimeUmamiHost() {
  return "";
}
function getBuildTimeUmamiWebsiteID() {
  return "";
}
function createTelemetryClient(config) {
  if (!config.enabled || !config.websiteID) {
    return new NoopTelemetryClient();
  }
  const endpoint = normalizeEndpoint(config.host);
  if (!endpoint) {
    return new NoopTelemetryClient();
  }
  return new HttpTelemetryClient(endpoint, config);
}
var defaultClient = null;
function initDefaultTelemetry(init) {
  const resolved = resolveTelemetryConfig({
    env: init.env || process.env,
    buildHost: getBuildTimeUmamiHost(),
    buildWebsiteID: getBuildTimeUmamiWebsiteID()
  });
  defaultClient = createTelemetryClient({
    enabled: resolved.enabled,
    host: resolved.host,
    websiteID: resolved.websiteID,
    app: init.app,
    version: init.version,
    platform: init.platform,
    arch: init.arch
  });
  return defaultClient;
}
var NoopTelemetryClient = class {
  track() {
  }
  pageview() {
  }
  async close() {
  }
};
var HttpTelemetryClient = class {
  constructor(endpoint, config) {
    this.endpoint = endpoint;
    this.websiteID = config.websiteID;
    this.app = config.app;
    this.version = config.version;
    this.platform = config.platform || "";
    this.arch = config.arch || "";
    this.fetchImpl = config.fetch || fetch;
    this.timeoutMs = config.requestTimeoutMs || DEFAULT_REQUEST_TIMEOUT_MS;
    this.userAgent = `${config.app}/${config.version} telemetry`;
    this.inFlight = /* @__PURE__ */ new Set();
    this.closed = false;
  }
  track(name, fields = {}) {
    if (this.closed) return;
    const trimmed = String(name || "").trim();
    if (!trimmed) return;
    this.send(trimmed, eventURL(this.app, trimmed), fields);
  }
  pageview(path5, fields = {}) {
    if (this.closed) return;
    this.send("", normalizePagePath(path5), fields);
  }
  async close(timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS) {
    this.closed = true;
    if (this.inFlight.size === 0 || timeoutMs <= 0) return;
    const drained = Promise.allSettled(Array.from(this.inFlight)).then(() => void 0);
    await Promise.race([
      drained,
      new Promise((resolve) => {
        setTimeout(resolve, timeoutMs);
      })
    ]);
  }
  send(name, url, fields) {
    const data = { ...fields };
    if (this.platform && data.platform === void 0) data.platform = this.platform;
    if (this.arch && data.arch === void 0) data.arch = this.arch;
    if (data.version === void 0) data.version = this.version;
    const payload = {
      type: "event",
      payload: {
        website: this.websiteID,
        hostname: DEFAULT_HOSTNAME,
        title: DEFAULT_TITLE,
        url,
        name,
        data,
        timestamp: Math.floor(Date.now() / 1e3)
      }
    };
    let body;
    try {
      body = JSON.stringify(payload);
    } catch {
      return;
    }
    const request = this.fire(body);
    this.inFlight.add(request);
    request.finally(() => this.inFlight.delete(request));
  }
  async fire(body) {
    try {
      const response = await this.fetchImpl(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": this.userAgent
        },
        body,
        signal: AbortSignal.timeout(this.timeoutMs)
      });
      try {
        await response.body?.cancel?.();
      } catch {
      }
    } catch {
    }
  }
};
function normalizeEndpoint(host) {
  let url;
  try {
    url = new URL(String(host || "").trim());
  } catch {
    return null;
  }
  if (!url.protocol || !url.host) return null;
  const pathname = url.pathname.replace(/\/+$/, "");
  url.pathname = pathname.endsWith(UMAMI_PATH) ? pathname : pathname + UMAMI_PATH;
  return url.toString();
}
function eventURL(app, name) {
  if (!name) return `app://${app}`;
  return `app://${app}/${name.replace(/\./g, "/")}`;
}
function normalizePagePath(path5) {
  const trimmed = String(path5 || "").trim();
  if (!trimmed) return "/";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

// src/cli.js
var COMMANDS = /* @__PURE__ */ new Set(["open", "poll", "end", "stop", "server", "playbook", "design", "setup"]);
var DESCRIPTION = "Lavish Editor helps agents turn rich HTML artifacts into collaborative human review surfaces. Whenever you are about to give user a complex response that will be easier to understand via a rich / interactive page, consider using Lavish Editor. First generate an interactive HTML artifact according to user request, then run `lavish-axi <html-file>` so the user can visually review it, annotate elements or selected text, queue prompts, and send feedback back through `lavish-axi poll`.";
var VERSION = "0.1.31";
async function run(argv) {
  await ensureStateDir();
  const normalizedArgv = normalizeArgv(argv);
  const isTopLevelHelp = argv.length === 1 && argv[0] === "--help";
  const command = telemetryCommandName(argv);
  const telemetry = initDefaultTelemetry({
    app: "lavish-axi",
    version: VERSION,
    platform: process.platform,
    arch: process.arch
  });
  telemetry.pageview(`/${command}`, { command });
  try {
    await runAxiCli({
      description: DESCRIPTION,
      version: VERSION,
      argv: isTopLevelHelp ? [] : normalizedArgv,
      topLevelHelp: TOP_LEVEL_HELP,
      home: async () => createHomeOutput({
        bin: process.argv[1] || "lavish-axi",
        sessions: isTopLevelHelp ? [] : await visibleSessions(),
        includeSessions: !isTopLevelHelp
      }),
      commands: {
        open: openCommand,
        poll: pollCommand,
        end: endCommand,
        stop: stopCommand,
        playbook: playbookCommand,
        design: designCommand,
        setup: setupCommand,
        server: serverCommand
      },
      getCommandHelp
    });
    telemetry.track("command", { command, status: "success" });
  } catch (error) {
    telemetry.track("command", { command, status: "error" });
    throw error;
  } finally {
    await telemetry.close(1e3);
  }
}
function collapseHomeDirectory(file, home) {
  const normalizedFile = file.replaceAll("\\", "/");
  const normalizedHome = home.replaceAll("\\", "/");
  if (normalizedFile === normalizedHome) {
    return "~";
  }
  if (normalizedFile.startsWith(`${normalizedHome}/`)) {
    return `~/${normalizedFile.slice(normalizedHome.length + 1)}`;
  }
  return file;
}
function normalizeArgv(argv) {
  const first = argv[0];
  if (!first || COMMANDS.has(first)) {
    return argv;
  }
  if (first.startsWith("-")) {
    return argv.some((arg) => isHtmlPath(arg)) ? ["open", ...argv] : argv;
  }
  return ["open", ...argv];
}
function telemetryCommandName(argv) {
  const normalized = normalizeArgv(argv);
  return normalized[0] && !normalized[0].startsWith("-") ? normalized[0] : "home";
}
function createHomeOutput({ bin, sessions, includeSessions = true }) {
  return {
    bin: collapseHomeDirectory(bin, os2.homedir()),
    description: DESCRIPTION,
    ...includeSessions ? {
      sessions: sessions.map((session) => ({
        file: session.file,
        status: session.status,
        url: session.url,
        pending_prompts: session.pending_prompts || 0
      }))
    } : {},
    visual_guidance: [
      "Use visual hierarchy to make the most important decisions, risks, tradeoffs, and next actions obvious at a glance",
      "Use visual structure such as sections, cards, tables, diagrams, annotated snippets, and side-by-side comparisons instead of long prose",
      "Choose typography, spacing, color, and layout deliberately so the artifact has a clear point of view",
      "Prevent horizontal overflow: design narrow layouts intentionally, use minmax(0, 1fr) and min-width: 0 for grid/flex children, and deliberately wrap or truncate long labels/status text"
    ],
    playbooks: listPlaybooks(),
    help: [
      "Run `lavish-axi <html-file>` to open or resume a Lavish Editor session",
      "Unless the user specifies another location, create HTML artifacts in the current working directory under `.lavish/`",
      "Lavish serves the html file through a local express.js server. If your html needs to reference other filesystem assets such as images, CSS, fonts, and local scripts, copy them into the same directory as the HTML file, then reference them with relative paths from that directory. Never prepend `/` to those asset paths - root paths won't work",
      "Run `lavish-axi poll <html-file>` to wait for user feedback. It long-polls and stays silent until the user sends feedback or ends the session, so leave it running - never kill it. If your harness limits how long a foreground command may run, run the poll as a background task; if it gets killed or times out anyway, just re-run it - queued feedback is never lost",
      "Run `lavish-axi end <html-file>` to end a session",
      "Run `lavish-axi stop` to shut down the background server (it also self-stops when idle or after the last session ends with nothing connected)",
      "Run `lavish-axi playbook <playbook_id>` for focused artifact guidance. One artifact often combines several playbooks (for example a plan that includes a comparison and a diagram), so read every playbook relevant to the artifact, not just one, for the best quality",
      DESIGN_SYSTEM_HINT,
      "Use lavish-axi when the user asks for a visual artifact, HTML explainer, interactive prototype, review surface, product or technical plan, comparison, report, or browser-based feedback loop"
    ]
  };
}
function createPlaybookOutput(args) {
  const id = args[0];
  if (!id) {
    return {
      playbooks: listPlaybooks(),
      help: [
        "Run `lavish-axi playbook <playbook_id>` for focused artifact guidance",
        "One artifact often combines several playbooks (for example a plan that includes a comparison and a diagram), so read every playbook relevant to the artifact, not just one, for the best quality"
      ]
    };
  }
  const playbook = findPlaybook(id);
  if (!playbook) {
    throw new AxiError(`Unknown playbook: ${id}`, "VALIDATION_ERROR", [
      `Run \`lavish-axi playbook\` to list known IDs: ${playbookIds().join(", ")}`
    ]);
  }
  return { playbook };
}
function createOpenOutput({ file, url, status }) {
  return {
    session: { file, url, status },
    next_step: `Do not respond to the user just yet. Now you must run \`lavish-axi poll ${file}\`. This command long-polls until the user sends feedback or ends the session, and it stays silent the whole time - that is normal, never kill it. Do not pass --timeout-ms during normal agent use. If your harness limits how long a foreground command may run, run the poll as a background task and wait for it to finish; if the poll still gets killed or times out, just re-run it - queued feedback is never lost. After applying feedback, run \`lavish-axi poll ${file} --agent-reply "<message for the user>"\` without --timeout-ms to show your response in Lavish Editor and wait for more feedback.`
  };
}
async function openCommand(args) {
  const file = args.find((arg) => !arg.startsWith("-"));
  if (!file) {
    throw new AxiError("HTML file path is required", "VALIDATION_ERROR", ["Run `lavish-axi <html-file>`"]);
  }
  await assertHtmlFile(file);
  const absolute = await canonicalFile(file);
  const baseUrl = await ensureServer({ forceRestart: shouldForceRestartForLocalBuild(process.argv[1] || "") });
  const response = await postJson(`${baseUrl}/api/sessions`, { file: absolute });
  if (shouldOpenBrowser(args, process.env)) {
    try {
      const open = (await import("open")).default;
      await open(response.url);
    } catch {
      response.status = "ready";
    }
  }
  return createOpenOutput({ file: absolute, url: response.url, status: response.status || "opened" });
}
function shouldOpenBrowser(args, env) {
  return !args.includes("--no-open") && env.LAVISH_AXI_NO_OPEN !== "1";
}
async function pollCommand(args) {
  const file = args[0];
  if (!file) {
    throw new AxiError("HTML file path is required", "VALIDATION_ERROR", ["Run `lavish-axi poll <html-file>`"]);
  }
  const absolute = await canonicalFile(file);
  const baseUrl = await ensureServer();
  const agentReply = flagValue(args, "--agent-reply");
  if (agentReply) {
    await postJson(`${baseUrl}/api/${sessionKey(absolute)}/agent-reply`, { text: agentReply });
  }
  const timeoutMs = flagValue(args, "--timeout-ms");
  const timeoutQuery = timeoutMs ? `&timeoutMs=${encodeURIComponent(timeoutMs)}` : "";
  const onPollSignal = (signal) => {
    process.stderr.write(`
${pollInterruptedText(absolute)}
`);
    process.exit(signal === "SIGINT" ? 130 : 143);
  };
  if (!timeoutMs) {
    process.on("SIGINT", onPollSignal);
    process.on("SIGTERM", onPollSignal);
  }
  const waitReporter = timeoutMs ? null : startPollWaitReporter({ file: absolute });
  try {
    const response = await fetchJson(`${baseUrl}/api/poll?file=${encodeURIComponent(absolute)}${timeoutQuery}`, {
      retries: 3,
      retryDelayMs: 500
    });
    return createPollOutput({ file: absolute, response });
  } finally {
    waitReporter?.stop();
    if (!timeoutMs) {
      process.off("SIGINT", onPollSignal);
      process.off("SIGTERM", onPollSignal);
    }
  }
}
function pollWaitBannerText(file) {
  return `[lavish-axi] Long-polling for user feedback on ${file}. This stays silent until the user sends feedback or ends the session - leave it running. If it gets killed or times out, re-run \`lavish-axi poll ${file}\` - queued feedback is never lost.`;
}
function pollWaitTickText(elapsedMs) {
  const minutes = Math.round(elapsedMs / 6e4);
  return `[lavish-axi] Still waiting for user feedback (${minutes}m). Leave this running until the user acts.`;
}
function pollInterruptedText(file) {
  return `[lavish-axi] Poll interrupted before user feedback arrived. The user may still be reviewing - re-run \`lavish-axi poll ${file}\` to keep waiting; queued feedback is never lost.`;
}
function startPollWaitReporter({
  file,
  write = (line) => {
    process.stderr.write(line);
  },
  intervalMs = 6e4
}) {
  write(`${pollWaitBannerText(file)}
`);
  let elapsedMs = 0;
  const timer = setInterval(() => {
    elapsedMs += intervalMs;
    write(`${pollWaitTickText(elapsedMs)}
`);
  }, intervalMs);
  timer.unref?.();
  return { stop: () => clearInterval(timer) };
}
function createPollOutput({ file, response }) {
  if (response.status === "missing") {
    throw new AxiError("No active Lavish Editor session for this file", "NOT_FOUND", [
      `Run \`lavish-axi ${file}\` first`
    ]);
  }
  if (response.status === "feedback") {
    return {
      session: { file, status: "feedback" },
      dom_snapshot: response.dom_snapshot || "",
      prompts: response.prompts || [],
      next_step: `Apply the requested changes to ${file}. Do not respond to the user just yet. Now you must run \`lavish-axi poll ${file} --agent-reply "<message for the user>"\` without --timeout-ms unless the user ended the session. The poll waits silently until the user sends more feedback or ends the session - never kill it. If your harness limits how long a foreground command may run, run the poll as a background task; if it still gets killed or times out, just re-run it - queued feedback is never lost.`
    };
  }
  if (response.status === "ended") {
    return { session: { file, status: "ended" } };
  }
  return {
    session: { file, status: response.status || "waiting" },
    next_step: `No user feedback arrived before the optional timeout. Run \`lavish-axi poll ${file}\` without --timeout-ms to wait indefinitely - queued feedback is never lost, so re-running the poll is always safe.`
  };
}
async function endCommand(args) {
  const file = args[0];
  if (!file) {
    throw new AxiError("HTML file path is required", "VALIDATION_ERROR", ["Run `lavish-axi end <html-file>`"]);
  }
  const absolute = await canonicalFile(file);
  const baseUrl = await ensureServer();
  const response = await postJson(`${baseUrl}/api/end`, { file: absolute });
  return { session: { file: absolute, status: response.status || "ended" } };
}
async function stopCommand(args) {
  const port = Number(flagValue(args, "--port") || defaultPort());
  const baseUrl = `http://${hostForUrl(clientHost())}:${port}`;
  return shutdownServerOnPort(port, { baseUrl, currentVersion: VERSION });
}
async function shutdownServerOnPort(port, {
  baseUrl = `http://${hostForUrl(clientHost())}:${port}`,
  currentVersion = VERSION,
  fetchHealth: healthFetcher = fetchHealth,
  requestShutdown: shutdownRequester = requestShutdown,
  waitForPortFree: portFreeWaiter = waitForPortFree,
  killProcessOnPort: portKiller = killProcessOnPort,
  processMatchesLavish = processOnPortMatchesLavish
} = {}) {
  const health = await healthFetcher(baseUrl);
  if (!health) {
    return { server: { status: "not-running", port } };
  }
  if (!await canControlServerOnPort(port, health, processMatchesLavish)) {
    return { server: { status: "not-lavish", port } };
  }
  await shutdownRequester(baseUrl);
  let freed = await portFreeWaiter(baseUrl, 3e3);
  if (!freed && shouldKillProcessOnPort(currentVersion, health)) {
    portKiller(port);
    freed = await portFreeWaiter(baseUrl, 3e3);
  }
  return { server: { status: freed ? "stopped" : "stopping", port } };
}
async function playbookCommand(args) {
  return createPlaybookOutput(args);
}
async function designCommand() {
  return createDesignOutput();
}
async function setupCommand(args) {
  if (args.length !== 1 || args[0] !== "hooks") {
    throw new AxiError("Unknown setup action", "VALIDATION_ERROR", ["Run `lavish-axi setup hooks`"]);
  }
  const errors = [];
  installSessionStartHooks({
    marker: "lavish-axi",
    binaryNames: ["lavish-axi"],
    distEntrypoints: ["dist/cli.mjs", "bin/lavish-axi.js"],
    homeDir: resolveHookHomeDir(),
    onError: (message) => errors.push(message)
  });
  if (errors.length > 0) {
    throw new AxiError("Failed to install lavish-axi agent hooks", "SERVER_ERROR", errors);
  }
  return {
    hooks: { status: "installed", integrations: "Claude Code, Codex, OpenCode" },
    help: ["Restart your agent session to receive lavish-axi ambient context"]
  };
}
function resolveHookHomeDir(env = process.env, fallback = os2.homedir()) {
  return env.HOME || fallback;
}
async function serverCommand(args) {
  const port = Number(flagValue(args, "--port") || defaultPort());
  const debug = args.includes("--verbose") || process.env.LAVISH_AXI_DEBUG === "1";
  const server = await serve({ port, stateFile: stateFile(), version: VERSION, debug });
  await server.done;
  return "";
}
async function visibleSessions() {
  const store = new SessionStore(stateFile());
  return (await store.listSessions()).filter((session) => session.status !== "ended");
}
async function assertHtmlFile(file) {
  if (!isHtmlPath(file)) {
    throw new AxiError("Lavish Editor expects an HTML file", "VALIDATION_ERROR", ["Run `lavish-axi <html-file>`"]);
  }
  try {
    await access(file);
  } catch {
    throw new AxiError(`File not found: ${file}`, "NOT_FOUND", [
      "Create the HTML artifact first, then run `lavish-axi <html-file>`"
    ]);
  }
}
function isHtmlPath(file) {
  return file.toLowerCase().endsWith(".html") || file.toLowerCase().endsWith(".htm");
}
async function ensureServer({ forceRestart = false } = {}) {
  const port = defaultPort();
  const baseUrl = `http://${hostForUrl(clientHost())}:${port}`;
  const existing = await fetchHealth(baseUrl);
  if (existing && !shouldRestartServer(VERSION, existing, forceRestart)) {
    return baseUrl;
  }
  if (existing) {
    if (!await canControlServerOnPort(port, existing, processOnPortMatchesLavish)) {
      throw new AxiError(`Port ${port} is occupied by a non-Lavish server`, "SERVER_ERROR", [
        `Stop the process using port ${port}, or set LAVISH_AXI_PORT to another port`
      ]);
    }
    await requestShutdown(baseUrl);
    const freed = await waitForPortFree(baseUrl, 2e3);
    if (!freed) {
      if (shouldKillProcessOnPort(VERSION, existing)) {
        killProcessOnPort(port);
        await waitForPortFree(baseUrl, 3e3);
      }
    }
  }
  await startServer(port);
  const deadline = Date.now() + 5e3;
  while (Date.now() < deadline) {
    const health = await fetchHealth(baseUrl);
    if (health && !shouldRestartServer(VERSION, health)) {
      return baseUrl;
    }
    await delay(100);
  }
  throw new AxiError("Lavish Editor server did not start", "SERVER_ERROR", [
    `Run \`lavish-axi server --port ${port}\` to inspect server startup`
  ]);
}
function shouldRestartServer(currentVersion, healthBody, forceRestart = false) {
  if (!healthBody || typeof healthBody !== "object") return false;
  if (forceRestart && healthBody.app === "lavish-axi") return true;
  if (typeof healthBody.version !== "string" || healthBody.version === "") return true;
  return healthBody.version !== currentVersion;
}
function shouldForceRestartForLocalBuild(executablePath, sourceServerExists = localSourceServerExists()) {
  const localBuildEntry = fileURLToPath(new URL("../dist/cli.mjs", import.meta.url));
  return sourceServerExists && path4.resolve(executablePath) === path4.resolve(localBuildEntry);
}
function localSourceServerExists() {
  return existsSync(fileURLToPath(new URL("../src/server.js", import.meta.url)));
}
function shouldKillProcessOnPort(currentVersion, healthBody) {
  if (!healthBody || typeof healthBody !== "object") return false;
  if (typeof healthBody.version !== "string" || healthBody.version === "") return true;
  if (healthBody.app !== "lavish-axi") return false;
  return healthBody.version !== currentVersion;
}
async function canControlServerOnPort(port, healthBody, processMatchesLavish) {
  if (!healthBody || typeof healthBody !== "object") return false;
  if (healthBody.app === "lavish-axi") return true;
  if (typeof healthBody.version === "string" && healthBody.version !== "") return false;
  return processMatchesLavish(port);
}
async function fetchHealth(baseUrl) {
  try {
    const response = await fetch(`${baseUrl}/health`);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}
async function requestShutdown(baseUrl) {
  try {
    await fetch(`${baseUrl}/shutdown`, { method: "POST" });
  } catch {
  }
}
async function waitForPortFree(baseUrl, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!await fetchHealth(baseUrl)) return true;
    await delay(100);
  }
  return false;
}
function killProcessOnPort(port) {
  try {
    const result = spawnSync("lsof", ["-t", `-iTCP:${port}`, "-sTCP:LISTEN"], { encoding: "utf8" });
    if (result.status !== 0) return;
    for (const line of result.stdout.split("\n")) {
      const pid = Number(line.trim());
      if (Number.isInteger(pid) && pid > 0 && pid !== process.pid) {
        try {
          process.kill(pid, "SIGTERM");
        } catch {
        }
      }
    }
  } catch {
  }
}
function processOnPortMatchesLavish(port) {
  try {
    const pids = spawnSync("lsof", ["-t", `-iTCP:${port}`, "-sTCP:LISTEN"], { encoding: "utf8" });
    if (pids.status !== 0) return false;
    for (const line of pids.stdout.split("\n")) {
      const pid = Number(line.trim());
      if (!Number.isInteger(pid) || pid <= 0 || pid === process.pid) continue;
      const command = spawnSync("ps", ["-p", String(pid), "-o", "command="], { encoding: "utf8" });
      if (command.status === 0 && /lavish-axi/.test(command.stdout)) {
        return true;
      }
    }
  } catch {
    return false;
  }
  return false;
}
async function startServer(port) {
  await ensureStateDir();
  const entry = resolveServerEntry();
  let logFd = null;
  try {
    logFd = openSync(serverLogFile(), "a");
  } catch {
  }
  try {
    const child = spawn(process.execPath, [entry, "server", "--port", String(port)], createServerSpawnOptions(logFd));
    child.unref();
  } finally {
    if (logFd !== null) closeSync(logFd);
  }
}
function resolveServerEntry() {
  const binEntry = fileURLToPath(new URL("../bin/lavish-axi.js", import.meta.url));
  if (existsSync(binEntry)) return binEntry;
  return fileURLToPath(import.meta.url);
}
function createServerSpawnOptions(logFd = null) {
  const stdio = (
    /** @type {import("node:child_process").StdioOptions} */
    logFd === null ? "ignore" : ["ignore", logFd, logFd]
  );
  return {
    detached: true,
    stdio,
    env: { ...process.env, LAVISH_AXI_NO_OPEN: "1" }
  };
}
async function fetchJson(url, { retries = 0, retryDelayMs = 250 } = {}) {
  let response;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      response = await fetch(url);
      break;
    } catch (error) {
      if (error instanceof AxiError) throw error;
      if (attempt >= retries) throw serverConnectionError();
      await delay(retryDelayMs);
    }
  }
  if (!response) throw serverConnectionError();
  if (!response.ok) {
    throw new AxiError(`Lavish Editor request failed: ${response.status}`, "SERVER_ERROR");
  }
  try {
    return await response.json();
  } catch {
    throw pollResponseInterruptedError();
  }
}
async function postJson(url, body) {
  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
  } catch {
    throw serverConnectionError();
  }
  if (!response.ok) {
    throw new AxiError(`Lavish Editor request failed: ${response.status}`, "SERVER_ERROR");
  }
  return response.json();
}
function serverConnectionError() {
  return new AxiError("Lavish Editor server connection failed", "SERVER_ERROR", [
    "Run `lavish-axi server --verbose` or inspect `~/.lavish-axi/server.log` (`LAVISH_AXI_STATE_DIR/server.log` when set) for server startup or crash diagnostics",
    "Re-run the last `lavish-axi poll <html-file>` command after the server is healthy"
  ]);
}
function pollResponseInterruptedError() {
  return new AxiError("Lavish Editor poll response was interrupted", "SERVER_ERROR", [
    "Run `lavish-axi server --verbose` or inspect `~/.lavish-axi/server.log` (`LAVISH_AXI_STATE_DIR/server.log` when set) for server startup or crash diagnostics",
    "Re-run the last `lavish-axi poll <html-file>` command after the server is healthy"
  ]);
}
function flagValue(args, flag) {
  const index = args.indexOf(flag);
  if (index === -1) {
    return null;
  }
  return args[index + 1] || null;
}
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function getCommandHelp(command) {
  return COMMAND_HELP[command] || null;
}
var TOP_LEVEL_HELP = `lavish-axi - Lavish Editor AXI

Usage:
  lavish-axi
  lavish-axi <html-file>
  lavish-axi poll <html-file> [--agent-reply "..."]
  lavish-axi end <html-file>
  lavish-axi stop
  lavish-axi playbook [playbook_id]
  lavish-axi design
  lavish-axi setup hooks

${DESIGN_SYSTEM_HINT}

Note: poll long-polls indefinitely by default until the user sends feedback or ends the session, staying silent while it waits - never kill it. Do not pass --timeout-ms during normal agent use; it is for tests and debugging only. If your harness limits how long a foreground command may run, run the poll as a background task; if it gets killed or times out anyway, just re-run it - queued feedback is never lost.

`;
var COMMAND_HELP = {
  open: `Usage: lavish-axi <html-file> [--no-open]

Open or resume a Lavish Editor review session for an HTML artifact. Use --no-open when you need to ensure the server/session exists without opening another browser window.
`,
  poll: `Usage: lavish-axi poll <html-file> [--agent-reply "..."]

This command long-polls indefinitely for queued user prompts, then returns them to the agent. It stays silent while it waits - that is normal, never kill it. Do not pass --timeout-ms during normal agent use; it is for tests and debugging only. If your harness limits how long a foreground command may run, run the poll as a background task and wait for it to finish; if it still gets killed or times out, just re-run it - queued feedback is never lost. Use --agent-reply after applying prior feedback to display your response in Lavish Editor before waiting again.
`,
  end: `Usage: lavish-axi end <html-file>

End a Lavish Editor session.
`,
  stop: `Usage: lavish-axi stop [--port <port>]

Shut down the background Lavish Editor server. The server also stops itself when no browser or poll has been connected for a while (LAVISH_AXI_IDLE_TIMEOUT_MS, default 30m) and immediately when the last session ends with nothing connected.
`,
  playbook: `Usage: lavish-axi playbook [playbook_id]

List focused artifact guidance playbooks, or show one playbook by ID. Known IDs: diagram, table, comparison, plan, code, input, slides.

One artifact often combines several playbooks (for example a plan that includes a comparison and a diagram), so read every playbook relevant to the artifact, not just one, for the best quality.

Examples:
  lavish-axi playbook
  lavish-axi playbook diagram
  lavish-axi playbook input
`,
  design: `Usage: lavish-axi design

Show a copy-pasteable CDN snippet for Tailwind CSS browser runtime v4 + DaisyUI v5 + themes, plus technical reference for DaisyUI components. Lavish artifacts stay portable HTML. This CDN snippet is the design fallback, not the default: inspect the subject project before falling back. The strict priority order is: (1) if the user asked for a specific look or named design system, follow that; (2) otherwise, match the design system of the project the artifact is about, not necessarily your current working directory. If the artifact previews, proposes, or mocks a specific app's UI, use that app's own design system; (3) only when both come up empty, prefer the Lavish-recommended Tailwind + DaisyUI CDN snippet over hand-writing styles unless explicitly instructed otherwise by the user.
`,
  setup: `Usage: lavish-axi setup hooks

Install or repair agent SessionStart hooks for lavish-axi ambient context in Claude Code, Codex, and OpenCode. Restart your agent session afterward to receive the context.
`,
  server: `Usage: lavish-axi server [--port 4387] [--verbose]

Run the local Lavish Editor server. Pass --verbose (or set LAVISH_AXI_DEBUG=1) to log session and watcher events to stderr. Detached server output is appended to ~/.lavish-axi/server.log, or LAVISH_AXI_STATE_DIR/server.log when set, for startup and crash diagnostics.

LAVISH_AXI_HOST sets the bind address (default 127.0.0.1; a wildcard 0.0.0.0 or :: binds every interface). Binding beyond loopback exposes an unauthenticated server that can read and serve arbitrary local files to anything that can reach it, so only do so on a trusted network. LAVISH_AXI_LINK_HOST sets the hostname written into generated session links (default: the bind address, or loopback when bound to a wildcard). LAVISH_AXI_NO_OPEN=1 (or --no-open) suppresses the local browser launch.
`
};

// bin/lavish-axi.js
await run(process.argv.slice(2));
