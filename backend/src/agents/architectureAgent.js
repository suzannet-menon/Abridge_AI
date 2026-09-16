import { hash, pick } from '../utils/hash.js';
import { runLLMStage, MODE } from '../services/llm.js';
import { buildArchitecturePrompt } from '../prompts/prompts.js';

const MODULE_POOL = [
  'core / domain logic',
  'CLI entrypoint',
  'web / API layer',
  'persistence adapter',
  'config & env handling',
  'logging & observability',
  'error taxonomy',
  'test harness / fixtures',
  'event bus / message queue',
  'authentication adapter',
  'input normalization adapter',
  'output renderer / exporter',
];

const FLOWS = [
  'input → parse → transform → output',
  'request → validate → execute → persist → respond',
  'collect → analyze → summarize → deliver',
  'watch → filter → act → report',
  'ingest → normalize → process → emit',
  'capture → classify → enrich → publish',
];

const PRINCIPLES = [
  'Pure core, thin shell: all logic deterministic and side-effect free.',
  'Adapters at the edges: swap CLI for web without touching core.',
  'Every module gets a unit test with fixed fixtures.',
  'Fail loudly at the boundary, silently never inside the core.',
  'Prefer composition over inheritance; small functions, clear names.',
  'Ship the vertical slice before the breadth: one real path, fully done.',
];

const SHAPE_BY_TYPE = {
  tool: 'input → parse → transform → output',
  'web-app': 'request → validate → execute → persist → respond',
  'data-pipeline': 'collect → analyze → summarize → deliver',
  service: 'ingest → normalize → process → emit',
};

const FALLBACK_SHAPE = 'input → parse → transform → output';

function deterministicParts(input) {
  const seedKey = (input.idea || '') + '|arch~' + (input.stack || '') + '|' + (input.customStack || '') +
    '|' + (input.type || '') + '|' + (input.audience || '') + '|' + (input.deadline || '');
  const seed = hash(seedKey);
  const shape = SHAPE_BY_TYPE[input.type] || FALLBACK_SHAPE;
  return {
    shape,
    modules: pick(seed, MODULE_POOL, 4),
    flow: pick(seed ^ 0x2545f491, FLOWS, 1)[0],
    principles: pick(seed ^ 0x14b2d4c7, PRINCIPLES, 3),
  };
}

function clampArr(arr, n) {
  if (!Array.isArray(arr)) return null;
  const items = arr.map(x => String(x).trim()).filter(Boolean).slice(0, n);
  return items.length ? items : null;
}

function normalize(input, part, fallback) {
  const modules = clampArr(part?.modules, 4) || fallback.modules;
  const principles = clampArr(part?.principles, 3) || fallback.principles;
  const flow = String(part?.flow || '').trim() || fallback.flow;
  const shape = String(part?.shape || '').trim() || fallback.shape;

  return { shape, modules, flow, principles };
}

function renderText(input, a) {
  const lines = [
    `Shape: ${a.shape}`,
    '',
    'Modules',
    ...a.modules.map((m, i) => `  ${i + 1}. ${m}`),
    '',
    'Data flow',
    `  ${a.flow}`,
    '',
    'Design principles',
    ...a.principles.map(p => `  • ${p}`),
    '',
    'Notes',
    '  Adapt this blueprint to your specific domain. The module names are',
    '  starting points — rename them to match your project language.',
  ];
  return lines.join('\n');
}

/**
 * Architecture stage. Gemini → Grok-first with a deterministic fallback: when a
 * key is set, the model derives idea-specific modules/flow/principles; without
 * one the bundled pools are hash-picked. Always returns the same structured
 * shape { shape, modules, flow, principles, text, mode }.
 */
export async function runArchitectureAgent(ctx) {
  const input = ctx?.input || {};

  const seedKey = (input.idea || '') + '|' + (input.stack || '') + '|' + (input.customStack || '') +
    '|' + (input.type || '') + '|' + (input.deadline || '') + '|' + (input.audience || '') + '|arch';
  const llm = await runLLMStage(seedKey, buildArchitecturePrompt(input, ctx));

  if (llm.ok) {
    const parts = normalize(input, llm.data, deterministicParts(input));
    return { ...parts, text: renderText(input, parts), mode: llm.mode };
  }

  const parts = deterministicParts(input);
  return { ...parts, text: renderText(input, parts), mode: MODE.DETERMINISTIC };
}