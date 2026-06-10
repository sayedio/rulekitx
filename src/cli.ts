#!/usr/bin/env node
// src/cli.ts
// RuleKit v2 CLI — global prompt governance system

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import path from "path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { initRuleKit } from "./init.js";
import { parsePrompt } from "./parser.js";
import { composePrompt } from "./composer.js";
import { discoverSkills, getCompletionItems } from "./loader.js";
import { syncIdeSnippets, syncAgentConfigs } from "./ide-sync.js";
import {
  resolveRulekitDir,
  getGlobalRulekitDir,
  getLocalRulekitDir,
} from "./global-resolver.js";
import { previewUninstall, uninstallRuleKit } from "./uninstall.js";
import { generateProjectMemory } from "./project-memory.js";
import { buildMdc } from "./init.js";

const program = new Command();

program
  .name("rulekitx")
  .description("Composable AI Engineering Governance System — Global Edition")
  .version("1.0.0");

// ═══════════════════════════════════════════════════════════════
// INIT — Scaffold RuleKit (global by default, --local for project)
// ═══════════════════════════════════════════════════════════════
program
  .command("init")
  .description("Scaffold RuleKit rules (global ~/.rulekit/ by default)")
  .option(
    "-l, --local",
    "Initialize in current project directory (.rulekit/) instead of global",
  )
  .action(async (options: { local?: boolean }) => {
    const spinner = ora("Initializing RuleKit...").start();
    try {
      const result = await initRuleKit({
        local: options.local,
        projectDir: process.cwd(),
      });

      spinner.succeed(chalk.green("RuleKit initialized successfully!"));

      if (result.alreadyExisted) {
        console.log(
          chalk.yellow(
            "\nNote: Existing RuleKit directory was updated with missing files.",
          ),
        );
      }

      const location = options.local ? "local project" : "global";
      console.log(
        `\nInstalled ${result.createdFiles.length} files to ${chalk.blue(result.rootDir)} (${location}):\n`,
      );

      // Group by directory for cleaner output
      const byDir: Record<string, string[]> = {};
      for (const file of result.createdFiles) {
        const dir = path.dirname(file);
        const name = path.basename(file);
        if (!byDir[dir]) byDir[dir] = [];
        byDir[dir].push(name);
      }

      for (const [dir, files] of Object.entries(byDir)) {
        console.log(chalk.cyan(`  ${dir === "." ? "/" : dir + "/"}`));
        for (const file of files) {
          console.log(`    ${file}`);
        }
      }

      if (result.removedFiles.length > 0) {
        console.log(
          chalk.yellow(
            `\nPruned ${result.removedFiles.length} stale file(s) no longer in the template manifest:`,
          ),
        );
        for (const file of result.removedFiles) {
          console.log(`  ${chalk.gray("✗")} ${file}`);
        }
      }

      console.log("\nReady to use! Try running:");
      console.log(chalk.blue("  rulekit list"));
      console.log(
        chalk.blue('  rulekit parse "/rulekit-architect build a new feature"'),
      );
    } catch (err: any) {
      spinner.fail(chalk.red("Initialization failed"));
      console.error(err.message);
      process.exit(1);
    }
  });

// ═══════════════════════════════════════════════════════════════
// MEMORY — (Re)generate the Layer 3 project memory file
// ═══════════════════════════════════════════════════════════════
program
  .command("memory")
  .description(
    "Generate or refresh the project memory file (.rulekit/project-memory.md) from detected stack",
  )
  .option(
    "-f, --force",
    "Overwrite an existing project-memory.md (loses manual edits)",
  )
  .action(async (options: { force?: boolean }) => {
    const fs = await import("fs/promises");
    const projectDir = process.cwd();
    const localDir = getLocalRulekitDir(projectDir);
    const memoryPath = path.join(localDir, "project-memory.md");

    const spinner = ora("Detecting project stack...").start();
    try {
      let exists = false;
      try {
        await fs.access(memoryPath);
        exists = true;
      } catch {
        // not present yet
      }

      if (exists && !options.force) {
        spinner.warn(
          chalk.yellow("project-memory.md already exists."),
        );
        console.log(
          chalk.gray(
            `  ${memoryPath}\n  Re-run with --force to regenerate (this discards manual edits).`,
          ),
        );
        return;
      }

      await fs.mkdir(localDir, { recursive: true });
      const content = await generateProjectMemory(projectDir);
      await fs.writeFile(memoryPath, content, "utf-8");

      // Refresh the Cursor always-on rule if a rules dir exists.
      const cursorRulesDir = path.join(projectDir, ".cursor", "rules");
      try {
        await fs.access(cursorRulesDir);
        const { stripFrontmatter } = await import("./loader.js");
        await fs.writeFile(
          path.join(cursorRulesDir, "rulekit-project-memory.mdc"),
          buildMdc({
            description:
              "Project-scoped memory: stack, architecture, conventions, business rules.",
            body: stripFrontmatter(content),
            alwaysApply: true,
          }),
          "utf-8",
        );
      } catch {
        // no cursor rules dir — skip
      }

      spinner.succeed(chalk.green("Project memory generated."));
      console.log(`\n  ${chalk.blue(memoryPath)}`);
      console.log(
        chalk.gray(
          "\nReview the file and replace every <!-- fill in --> with your project's truth.",
        ),
      );
    } catch (err: any) {
      spinner.fail(chalk.red("Failed to generate project memory"));
      console.error(err.message);
      process.exit(1);
    }
  });

// ═══════════════════════════════════════════════════════════════
// UNINSTALL — Remove everything RuleKit wrote into the user's home dir
// ═══════════════════════════════════════════════════════════════
program
  .command("uninstall")
  .description(
    "Remove ~/.rulekit/, agent skill dirs, IDE snippets, and lock-file entries. " +
      "Does NOT remove the rulekit npm package itself (run `npm uninstall -g rulekit` for that).",
  )
  .option(
    "-l, --local",
    "Uninstall the project-local .rulekit/ (./.rulekit/) instead of the global one",
  )
  .option("-y, --yes", "Skip the confirmation prompt")
  .action(async (options: { local?: boolean; yes?: boolean }) => {
    try {
      const preview = await previewUninstall({
        local: options.local,
        projectDir: process.cwd(),
      });

      const location = options.local ? "local project" : "global";
      console.log(
        chalk.bold(`\nRuleKit uninstall (${location})`),
      );

      if (!preview.rulekitDirFound) {
        console.log(
          chalk.yellow(
            `No RuleKit directory found at ${preview.rulekitDir}.`,
          ),
        );
      } else {
        console.log(
          chalk.cyan(`  - ${preview.rulekitDir} (root config)`),
        );
      }

      if (preview.removedSkillDirs.length > 0) {
        console.log(chalk.cyan("\nAgent skill subdirs to remove:"));
        for (const d of preview.removedSkillDirs) {
          console.log(`  - ${d}`);
        }
      }

      if (preview.removedSnippetFiles.length > 0) {
        console.log(chalk.cyan("\nIDE snippet files to remove:"));
        for (const f of preview.removedSnippetFiles) {
          console.log(`  - ${f}`);
        }
      }

      if (preview.removedManagedBlocks.length > 0) {
        console.log(chalk.cyan("\nManaged blocks to strip (CLAUDE.md / AGENTS.md):"));
        for (const f of preview.removedManagedBlocks) {
          console.log(`  - ${f}`);
        }
      }

      if (preview.removedLockEntries.length > 0) {
        console.log(chalk.cyan("\nLock-file entries to remove:"));
        for (const lf of preview.removedLockEntries) {
          console.log(`  - ${lf.lockFile}`);
          for (const e of lf.entries) {
            console.log(`      ${e}`);
          }
        }
      }

      const totalChanges =
        (preview.rulekitDirFound ? 1 : 0) +
        preview.removedSkillDirs.length +
        preview.removedSnippetFiles.length +
        preview.removedManagedBlocks.length +
        preview.removedLockEntries.reduce((s, l) => s + l.entries.length, 0);

      if (totalChanges === 0) {
        console.log(
          chalk.green(
            "\nNothing to remove. RuleKit is already fully uninstalled.",
          ),
        );
        console.log(
          chalk.gray(
            "Run `npm uninstall -g rulekit` to remove the CLI package.",
          ),
        );
        return;
      }

      if (!options.yes) {
        if (!input.isTTY) {
          console.log(
            chalk.red(
              "\nNon-interactive shell detected. Re-run with --yes to confirm.",
            ),
          );
          process.exit(1);
        }
        const rl = createInterface({ input, output });
        let answer = "";
        try {
          answer = (await rl.question("\nProceed? [y/N] ")).trim().toLowerCase();
        } finally {
          rl.close();
        }
        if (answer !== "y" && answer !== "yes") {
          console.log(chalk.yellow("Cancelled."));
          return;
        }
      }

      const spinner = ora("Removing RuleKit files...").start();
      const result = await uninstallRuleKit({
        local: options.local,
        projectDir: process.cwd(),
      });

      if (result.errors.length > 0) {
        spinner.warn(chalk.yellow("Uninstall completed with some errors."));
        for (const e of result.errors) {
          console.log(chalk.gray(`  ! ${e}`));
        }
      } else {
        spinner.succeed(chalk.green("RuleKit files removed."));
      }

      console.log(
        chalk.gray(
          "\nTo finish uninstalling, also remove the CLI package:",
        ),
      );
      console.log(chalk.blue("  npm uninstall -g rulekit"));
    } catch (err: any) {
      console.error(chalk.red("Uninstall failed:"));
      console.error(err.message);
      process.exit(1);
    }
  });

// ═══════════════════════════════════════════════════════════════
// INSTALL-IDE — Inject global snippets into VS Code, Cursor, JetBrains
// ═══════════════════════════════════════════════════════════════
program
  .command("install-ide")
  .description(
    "Install global autocomplete snippets & native AI skills into your IDEs (VS Code, Cursor, JetBrains, Copilot Chat)",
  )
  .action(async () => {
    const spinner = ora("Syncing IDE snippets globally...").start();
    try {
      const rootDir = await resolveRulekitDir();
      const results = await syncIdeSnippets(rootDir);

      if (results.errors.length > 0) {
        spinner.warn(chalk.yellow("Sync completed with some warnings."));
        for (const err of results.errors) {
          console.log(chalk.gray(`  ⚠ ${err}`));
        }
      } else {
        spinner.succeed(chalk.green("IDE snippets synced successfully!"));
      }

      if (results.created.length > 0) {
        console.log(chalk.bold("\nInjected Snippets & Native Skills Into:"));
        for (const file of results.created) {
          console.log(`  ${chalk.cyan("✓")} ${file}`);
        }
      } else {
        console.log(
          chalk.yellow(
            "\nNo compatible IDE config directories were found or updated.",
          ),
        );
      }

      const ideRemoved: string[] = (results as any).removed ?? [];
      if (ideRemoved.length > 0) {
        console.log(chalk.bold("\nPruned Stale Skills:"));
        for (const file of ideRemoved) {
          console.log(`  ${chalk.gray("✗")} ${file}`);
        }
      }

      // Also sync into known AI agent config dirs (OpenCode, Claude).
      // Skips silently if those tools aren't installed.
      const agentResults = await syncAgentConfigs(rootDir);
      if (agentResults.created.length > 0) {
        console.log(chalk.bold("\nInjected Native Skills Into Agent Configs:"));
        for (const file of agentResults.created) {
          console.log(`  ${chalk.cyan("✓")} ${file}`);
        }
      }
      if (agentResults.removed.length > 0) {
        console.log(chalk.bold("\nPruned Stale Agent Skills:"));
        for (const file of agentResults.removed) {
          console.log(`  ${chalk.gray("✗")} ${file}`);
        }
      }
      if (agentResults.errors.length > 0) {
        console.log(chalk.yellow("\nAgent config warnings:"));
        for (const err of agentResults.errors) {
          console.log(chalk.gray(`  ⚠ ${err}`));
        }
      }

      console.log(
        chalk.gray(
          "\nNote: For Neovim users, a rulekit-snippets.json file was generated in ~/.rulekit/",
        ),
      );
    } catch (err: any) {
      spinner.fail(chalk.red("Failed to sync IDE snippets"));
      console.error(err.message);
      process.exit(1);
    }
  });

// ═══════════════════════════════════════════════════════════════
// PARSE — Extract /rulekit-* commands from a prompt
// ═══════════════════════════════════════════════════════════════
program
  .command("parse <prompt...>")
  .description("Parse a prompt to extract /rulekit-* skill commands")
  .action((promptParts: string[]) => {
    const prompt = promptParts.join(" ");

    const result = parsePrompt(prompt);

    console.log(chalk.bold("\nParse Result:"));
    console.log(chalk.gray("────────────────────────────────────────"));
    console.log(
      `${chalk.cyan("Core Invoked:")} ${result.coreInvoked ? chalk.green("Yes") : chalk.yellow("No")}`,
    );
    console.log(
      `${chalk.cyan("Skills:")} ${result.skills.length > 0 ? result.skills.map((s) => chalk.blue(`/rulekit-${s}`)).join(", ") : chalk.yellow("None detected")}`,
    );
    console.log(`${chalk.cyan("Task:")}   ${result.task}`);
    console.log(chalk.gray("────────────────────────────────────────\n"));

    // Also output raw JSON for piping
    console.log(chalk.dim("JSON Output:"));
    console.log(JSON.stringify(result, null, 2));
  });

// ═══════════════════════════════════════════════════════════════
// COMPOSE — Build the full bulletproof prompt context
// ═══════════════════════════════════════════════════════════════
program
  .command("compose <prompt...>")
  .description(
    "Parse a prompt and compose the full XML-wrapped context for LLM injection",
  )
  .action(async (promptParts: string[]) => {
    const prompt = promptParts.join(" ");
    const spinner = ora("Composing bulletproof prompt...").start();

    try {
      const rootDir = await resolveRulekitDir();

      const parsed = parsePrompt(prompt);

      const result = await composePrompt({
        rootDir,
        skills: parsed.skills,
        task: parsed.task,
      });

      spinner.stop();

      if (result.warnings.length > 0) {
        console.log(chalk.yellow("\nWarnings:"));
        for (const warning of result.warnings) {
          console.log(chalk.yellow(`  ⚠️ ${warning}`));
        }
      }

      console.log(chalk.bold("\nComposition Layers:"));
      for (const layer of result.layers) {
        const color =
          layer.type === "core"
            ? chalk.magenta
            : layer.type === "skill"
              ? chalk.blue
              : chalk.white;
        console.log(`  ${color(`[${layer.type}]`)} ${layer.name}`);
      }

      console.log(chalk.bold("\nFinal Context (XML-wrapped):"));
      console.log(
        chalk.gray(
          "═════════════════════════════════════════════════════════════",
        ),
      );
      console.log(result.context);
      console.log(
        chalk.gray(
          "═════════════════════════════════════════════════════════════\n",
        ),
      );
    } catch (err: any) {
      spinner.fail(chalk.red("Composition failed"));
      console.error(err.message);
      console.log(chalk.gray(`\nTip: Did you run 'rulekit init' first?`));
      process.exit(1);
    }
  });

// ═══════════════════════════════════════════════════════════════
// LIST — Show all available /rulekit-* skills
// ═══════════════════════════════════════════════════════════════
program
  .command("list")
  .description("List all available /rulekit-* skills")
  .action(async () => {
    const spinner = ora("Discovering skills...").start();

    try {
      const rootDir = await resolveRulekitDir();

      const skills = await discoverSkills(rootDir);

      spinner.stop();

      if (skills.length === 0) {
        console.log(chalk.yellow(`No skills found in ${rootDir}/skills/`));
        console.log(
          chalk.gray(`Run 'rulekit init' to scaffold the default skills.`),
        );
        return;
      }

      console.log(chalk.bold(`\nAvailable Commands (${skills.length + 1})`));

      // Always show /rulekit core command first
      console.log(chalk.cyan("\n  CORE"));
      console.log(
        `    ${chalk.blue("/rulekit")} ${chalk.gray("— Load core engineering governance rules")}`,
      );

      // Group by category
      const byCategory: Record<string, typeof skills> = {};
      for (const skill of skills) {
        if (!byCategory[skill.category]) byCategory[skill.category] = [];
        byCategory[skill.category].push(skill);
      }

      for (const [category, catSkills] of Object.entries(byCategory)) {
        console.log(chalk.cyan(`\n  ${category.toUpperCase()}`));
        for (const skill of catSkills) {
          const desc = skill.description
            ? chalk.gray(` — ${skill.description}`)
            : "";
          console.log(`    ${chalk.blue(skill.command)}${desc}`);
        }
      }
      console.log("");
    } catch (err: any) {
      spinner.fail(chalk.red("Discovery failed"));
      console.error(err.message);
      process.exit(1);
    }
  });

// ═══════════════════════════════════════════════════════════════
// COMPLETIONS — Output all /rulekit-* commands for IDE extensions
// ═══════════════════════════════════════════════════════════════
program
  .command("completions")
  .description(
    "Output all /rulekit-* commands as JSON (for IDE extension consumption)",
  )
  .option("--format <format>", "Output format: json or plain", "json")
  .action(async (options: { format: string }) => {
    try {
      const rootDir = await resolveRulekitDir();
      const items = await getCompletionItems(rootDir);

      if (options.format === "plain") {
        for (const item of items) {
          console.log(`${item.command}\t${item.description}\t${item.category}`);
        }
      } else {
        console.log(JSON.stringify(items, null, 2));
      }
    } catch (err: any) {
      console.error(JSON.stringify({ error: err.message }));
      process.exit(1);
    }
  });

// ═══════════════════════════════════════════════════════════════
// DOCTOR — Health check for global installation
// ═══════════════════════════════════════════════════════════════
program
  .command("doctor")
  .description("Check RuleKit installation health")
  .action(async () => {
    console.log(chalk.bold("\nRuleKit Doctor\n"));

    const globalDir = getGlobalRulekitDir();

    // Check global directory
    try {
      const rootDir = await resolveRulekitDir();
      console.log(chalk.green(`  ✓ RuleKit directory found: ${rootDir}`));

      const isGlobal = rootDir === globalDir;
      console.log(
        chalk.gray(
          `    Type: ${isGlobal ? "Global (~/.rulekit/)" : "Local (project .rulekit/)"}`,
        ),
      );

      // Layer 1 — Core
      const fs = await import("fs/promises");
      console.log(chalk.bold("\n  Layer 1 — Core Memory (always-on)"));
      try {
        await fs.access(path.join(rootDir, "core.md"));
        console.log(chalk.green("    ✓ core.md exists"));
      } catch {
        console.log(
          chalk.red('    ✗ core.md missing — run "rulekit init" to fix'),
        );
      }

      // Layer 2 — Domain skills
      console.log(chalk.bold("\n  Layer 2 — Domain Skills (on-demand)"));
      try {
        const skills = await discoverSkills(rootDir);
        console.log(chalk.green(`    ✓ ${skills.length} skill(s) discovered`));
        for (const skill of skills) {
          console.log(chalk.gray(`      ${skill.command}`));
        }
      } catch {
        console.log(chalk.yellow("    ⚠ Skills directory not found"));
      }

      // Layer 3 — Project memory
      console.log(chalk.bold("\n  Layer 3 — Project Memory (project-scoped)"));
      try {
        await fs.access(path.join(rootDir, "project-memory.md"));
        console.log(chalk.green("    ✓ project-memory.md exists"));
      } catch {
        console.log(
          chalk.gray(
            "    – not present (run `rulekit init --local` or `rulekit memory` inside a project)",
          ),
        );
      }
    } catch {
      console.log(chalk.red(`  ✗ RuleKit not initialized`));
      console.log(chalk.gray(`    Expected global directory: ${globalDir}`));
      console.log(chalk.gray(`    Run: rulekit init`));
    }

    console.log("");
  });

program.parse(process.argv);
