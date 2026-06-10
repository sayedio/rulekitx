// src/index.ts
// Programmatic API exports for RuleKit v2

export * from './types.js';
export { parsePrompt } from './parser.js';
export { loadCore, loadSkill, discoverSkills, resolveSkills, getCompletionItems } from './loader.js';
export { composePrompt } from './composer.js';
export { initRuleKit } from './init.js';
export { syncIdeSnippets } from './ide-sync.js';
export type { InitOptions } from './init.js';
export { resolveRulekitDir, getGlobalRulekitDir, getLocalRulekitDir } from './global-resolver.js';
