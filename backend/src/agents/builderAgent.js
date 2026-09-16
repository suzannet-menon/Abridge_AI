import { STACKS } from '../domain/stacks.js';
import { slugify, scaffoldFiles, getScaffoldTree, filePurpose } from '../scaffold/scaffold.js';
import { parseDeadline, milestoneSlots } from '../domain/deadline.js';
import { runLLMStage, MODE } from '../services/llm.js';
import { buildBuilderPrompt } from '../prompts/prompts.js';

function normalizeShape(s) {
  const out = String(s || '').replace(/\s*(->|→|=>)\s*/g, ' → ').trim();
  return out || 'input → parse → transform → output';
}

function projectContext(ctx) {
  const input = ctx?.input || {};
  const arch = ctx?.results?.architecture || {};
  const stack = ctx?.results?.stack || {};
  const stackLabel = input.customStack || stack.label || 'TypeScript';
  const shape = normalizeShape(arch.shape);
  const core = (arch.modules || []).find(m => /core/i.test(m)) || 'the core module';
  const direction = ctx?.results?.research?.directions?.[0];
  return { stackLabel, shape, core, direction };
}

/** Project-aware fallback overview so the plan never reads as generic. */
function deterministicOverview(ctx) {
  const input = ctx?.input || {};
  const { shape } = projectContext(ctx);
  const type = input.type === 'data-pipeline' ? 'a data pipeline'
    : input.type === 'service' ? 'a service'
    : input.type === 'tool' ? 'a small tool'
    : 'a web app';
  const direction = ctx?.results?.research?.directions?.[0];
  const priming = direction ? ` Start from "${direction}":` : '';
  return `Build ${type} around the "${shape}" flow as its spine:${priming} prove the main input → output path in a deterministic core first, then add thin adapters around it.`;
}

/** Fallback milestones that reference the architecture the builder stage saw. */
function deterministicMilestones(ctx) {
  const { shape, core } = projectContext(ctx);
  const corePhrase = String(core).replace(/^the /, '');
  return [
    { week: 1, title: 'Foundation', tasks: ['Scaffold the repo from the starter files.', 'Wire build, test, and lint scripts.', `Add fixtures for the first ${corePhrase} sample.`], accept: 'the repo builds and the placeholder test passes.' },
    { week: 2, title: 'Core slice', tasks: [`Implement the main ${shape} flow in ${core}.`, 'Connect the entry point to the core.'], accept: 'running the entry point on the sample input produces the expected output.' },
    { week: 3, title: 'Harden', tasks: [`Add error taxonomy and edge-case handling for the ${shape} flow.`, `Unit-test ${core} with fixed fixtures.`], accept: 'all tests are green and failures are clear and actionable.' },
    { week: 4, title: 'Ship', tasks: ['Write docs and a README quick start.', 'Tag a release.'], accept: 'a fresh clone builds and runs straight from the README.' },
  ];
}

/**
 * Lenient normalization: keep every valid milestone the model returns and pad
 * the rest from the fallback template, instead of discarding the whole set.
 * Prevents a single malformed milestone from forcing an all-generic plan.
 */
function normalizeMilestones(arr, fallback) {
  const cleaned = [];
  if (Array.isArray(arr)) {
    arr.forEach((m, i) => {
      if (!m || typeof m !== 'object') return;
      const week = Number.isFinite(Number(m.week)) && Number(m.week) >= 1 ? Number(m.week) : i + 1;
      const tasks = Array.isArray(m.tasks)
        ? m.tasks.map(t => String(t).trim()).filter(Boolean).slice(0, 4)
        : [];
      const title = String(m.title || '').trim();
      const accept = String(m.accept || '').trim();
      if (!title || !tasks.length || !accept) return;
      cleaned.push({ week, title, tasks, accept });
    });
    if (cleaned.length >= 2) {
      while (cleaned.length < fallback.length) {
        const slot = fallback[cleaned.length];
        cleaned.push({ week: cleaned.length + 1, title: slot.title, tasks: slot.tasks, accept: slot.accept });
      }
      return cleaned.slice(0, fallback.length);
    }
  }
  return fallback;
}

function renderBuilderText({ overview, stackLabel, stackNoteLines, files, treeLines, milestones }) {
  const lines = [
    'Builder Plan',
    ...(overview ? ['', `Overview: ${overview}`] : []),
    '',
    `Scaffold: ${files.length} files · tree below (${stackLabel})`,
    ...(stackNoteLines.length ? ['', ...stackNoteLines] : []),
    '',
    'Starter project scaffold',
    ...treeLines.map(l => '  ' + l),
    '',
    'File purposes',
    ...files.map(f => `  ${f.path} — ${filePurpose(f.path)}`),
    '',
    'Implementation milestones',
    ...milestones.flatMap((m, i) => [
      `  Milestone ${i + 1} — ${m.slot || `Week ${m.week}`}: ${m.title}`,
      ...m.tasks.map(t => `    - ${t}`),
      `    ✓ Done when: ${m.accept}`,
    ]),
    '',
    'Note: This scaffold is a starting point for implementation, not production-ready software.',
    'Adapt file names and structure to match your specific project requirements.',
  ];
  return lines.join('\n');
}

export async function runBuilderAgent(ctx) {
  const input = ctx?.input || {};
  const stackKey = input.stack || 'unsure';
  const stack = STACKS[stackKey] || STACKS.unsure;
  const slug = slugify(input.name || input.idea || 'project');

  const stackLabel = input.customStack || stack.label;
  const stackNoteLines = (stackKey === 'unsure' && !input.customStack)
    ? ['Stack: recommended default (TypeScript / JavaScript) until the stack is decided.']
    : [];

  const fallback = deterministicMilestones(ctx);
  const days = parseDeadline(input.deadline).days;
  ctx.deadlineDays = days; // consumed by the builder prompt for deadline-sized milestones
  const llm = await runLLMStage(
    'builder:' + (input.idea || '') + '|' + stackLabel + '|' + (ctx?.results?.architecture?.shape || '') + '|' + (input.deadline || ''),
    buildBuilderPrompt(input, ctx),
  );

  let overview = null;
  let milestones = null;
  let mode = MODE.DETERMINISTIC;

  if (llm.ok) {
    milestones = normalizeMilestones(llm.data?.milestones, fallback);
    overview = String(llm.data?.overview || '').trim() || null;
    if (milestones === fallback) overview = null; // LLM milestones unusable → use coherent fallback overview too
    mode = llm.mode;
  }

  if (!milestones) milestones = fallback;
  if (!overview) overview = deterministicOverview(ctx);

  // Fit milestone labels to the deadline window (Day 1 / Day 2… for ≤ 14 days,
  // Week N otherwise) so a 5-day deadline never shows "Week 4".
  milestones = milestones.map((m, i) => ({
    ...m,
    slot: milestoneSlots(days, milestones.length)[i] || `Step ${i + 1}`,
  }));

  const files = scaffoldFiles(input, slug, { results: { ...ctx?.results, builder: { milestones, overview } } });
  const treeLines = getScaffoldTree(files, slug);

  const text = renderBuilderText({ overview, stackLabel, stackNoteLines, files, treeLines, milestones });
  return { text, folder: slug, files, overview, milestones, mode };
}