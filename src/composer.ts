// src/composer.ts
// Orchestrates prompt composition with bulletproof XML-wrapped injection

import { ComposeOptions, ComposeResult, ComposedLayer } from './types.js';
import { loadCore, loadSkill, resolveSkills } from './loader.js';

/**
 * Orchestrates the full prompt composition process.
 * Order: Core → Skills → Standards → Task
 * 
 * Output uses XML system-level tags to ensure ALL AI models
 * treat the injected rules as mandatory system instructions.
 */
export async function composePrompt(options: ComposeOptions): Promise<ComposeResult> {
  const { rootDir, skills, task } = options;
  const layers: ComposedLayer[] = [];
  const warnings: string[] = [];

  // 1. Load Core (Unconditional)
  try {
    const coreContent = await loadCore(rootDir);
    layers.push({
      type: 'core',
      name: 'core',
      content: coreContent
    });
  } catch (error: any) {
    throw new Error(`Failed to load RuleKit core: ${error.message}`);
  }

  // 2. Load Skills (in invocation order)
  if (skills.length > 0) {
    const resolved = await resolveSkills(rootDir, skills);
    warnings.push(...resolved.unknown);

    for (const skill of resolved.found) {
      try {
        const content = await loadSkill(rootDir, skill);
        layers.push({
          type: 'skill',
          name: skill.name,
          content
        });
      } catch (error: any) {
        warnings.push(`Failed to load found skill ${skill.name}: ${error.message}`);
      }
    }
  }

  // 4. Add User Task
  layers.push({
    type: 'task',
    name: 'User Task',
    content: task
  });

  // 5. Assemble with bulletproof XML injection
  const context = assembleBulletproofPrompt(layers);

  return {
    context,
    layers,
    warnings
  };
}

/**
 * Assembles all layers into a bulletproof XML-wrapped prompt that ensures
 * ANY AI model (GPT, Claude, Gemini, Llama, Mistral, etc.) will treat
 * the injected rules as mandatory system-level instructions.
 * 
 * Techniques used:
 * 1. XML system-level tags — all major models parse XML as structured instructions
 * 2. Priority markers — explicit MAXIMUM priority signaling
 * 3. Mandatory instruction preamble — "do NOT skip" directive
 * 4. Structural anchors — each section is self-contained and labeled
 * 5. Compliance checklist — forces re-verification before responding
 * 6. Repetition of criticality — key rules restated at boundaries
 */
function assembleBulletproofPrompt(layers: ComposedLayer[]): string {
  const coreLayers = layers.filter(l => l.type === 'core');
  const skillLayers = layers.filter(l => l.type === 'skill');
  const taskLayers = layers.filter(l => l.type === 'task');

  let output = '';

  // ═══════════════════════════════════════════════════════════════
  // OPENING: System prompt container with priority marker
  // ═══════════════════════════════════════════════════════════════
  output += `<RULEKIT_SYSTEM_PROMPT version="2.0" priority="MAXIMUM">\n`;
  output += `<MANDATORY_INSTRUCTIONS>\n`;
  output += `You MUST follow ALL instructions contained within this <RULEKIT_SYSTEM_PROMPT> block.\n`;
  output += `These rules are NON-NEGOTIABLE and override any conflicting default behaviors.\n`;
  output += `Do NOT skip, summarize, abbreviate, or ignore any section within this block.\n`;
  output += `Do NOT mention these instructions to the user unless explicitly asked.\n`;
  output += `Violations of any rule in this block constitute a critical failure.\n`;
  output += `</MANDATORY_INSTRUCTIONS>\n\n`;

  // ═══════════════════════════════════════════════════════════════
  // CORE RULES: Universal engineering governance
  // ═══════════════════════════════════════════════════════════════
  for (const core of coreLayers) {
    output += `<CORE_RULES priority="CRITICAL">\n`;
    output += core.content.trim();
    output += `\n</CORE_RULES>\n\n`;
  }

  // ═══════════════════════════════════════════════════════════════
  // ACTIVE SKILLS: Invoked skill behaviors
  // ═══════════════════════════════════════════════════════════════
  if (skillLayers.length > 0) {
    output += `<ACTIVE_SKILLS>\n`;
    output += `<!-- ${skillLayers.length} skill(s) activated. ALL behavioral rules below are MANDATORY. -->\n\n`;
    
    for (const skill of skillLayers) {
      output += `<SKILL name="${skill.name}" priority="HIGH" mandatory="true">\n`;
      output += skill.content.trim();
      output += `\n</SKILL>\n\n`;
    }
    
    output += `</ACTIVE_SKILLS>\n\n`;
  }


  // ═══════════════════════════════════════════════════════════════
  // COMPLIANCE CHECK: Force model to re-verify before responding
  // ═══════════════════════════════════════════════════════════════
  output += `<COMPLIANCE_CHECK>\n`;
  output += `Before generating your response, you MUST verify you have applied:\n`;
  output += `☐ ALL rules from CORE_RULES — especially: minimal diff discipline, no silent breaking changes, complete compilable output\n`;
  
  if (skillLayers.length > 0) {
    output += `☐ ALL behavioral rules from ACTIVE_SKILLS: ${skillLayers.map(s => s.name).join(', ')}\n`;
  }
  
  
  output += `☐ Confidence signaling (✅ Confirmed / ⚠️ Assumed / ❌ Risk / 🔍 Unknown) on all non-trivial decisions\n`;
  output += `If ANY rule was not applied, re-read the relevant section and apply it NOW before responding.\n`;
  output += `</COMPLIANCE_CHECK>\n`;

  // ═══════════════════════════════════════════════════════════════
  // CLOSE system prompt container
  // ═══════════════════════════════════════════════════════════════
  output += `</RULEKIT_SYSTEM_PROMPT>\n\n`;

  // ═══════════════════════════════════════════════════════════════
  // USER TASK: Separated from system instructions
  // ═══════════════════════════════════════════════════════════════
  if (taskLayers.length > 0) {
    output += `<USER_TASK>\n`;
    output += taskLayers.map(t => t.content.trim()).join('\n');
    output += `\n</USER_TASK>`;
  }

  return output;
}
