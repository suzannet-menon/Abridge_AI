import { buildBriefModel } from '../brief/model.js';
import { renderText } from '../brief/render.js';
import { runLLMStage, MODE } from '../services/gemini.js';
import { buildBriefPrompt } from '../prompts/prompts.js';

/**
 * Brief stage. Composes the canonical brief model from the pipeline context
 * (structured results only — no text slicing) and returns the model plus the
 * rendered text used on screen and in exports.
 *
 * When Gemini is available it tailors the story / next-steps / MVP sections;
 * otherwise the bundled defaults are used so the brief always renders.
 */
export async function runBriefAgent(ctx) {
  const input = ctx?.input || {};
  const seedKey = (input.idea || '') + '|' + (input.stack || '') + '|' + (input.type || '') +
    '|' + (input.audience || '') + '|' + (input.deadline || '');

  const llm = await runLLMStage('brief:' + seedKey, buildBriefPrompt(ctx));
  const brief = buildBriefModel(ctx, llm.ok ? llm.data : null);
  return { ...brief, text: renderText(brief), mode: llm.ok ? llm.mode : MODE.DETERMINISTIC };
}