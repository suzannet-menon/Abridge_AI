import { resolveStackLabel } from '../domain/stacks.js';
import { PROJECT_TYPES, TEAM_SIZES } from '../domain/types.js';

const NEXT_STEPS = [
  'Review the feasibility score and adjust scope if needed.',
  'Download the starter scaffold and unzip it locally.',
  'Run the build/test commands to confirm the scaffold works.',
  'Implement the core logic in the core module first.',
  'Add a unit test for every module before moving on.',
  'Follow the milestone plan: Foundation → Core slice → Harden → Ship.',
  'Export this project brief and keep it as your reference document.',
];

const MVP_GUIDANCE = [
  'Build the minimum that proves the core idea works end-to-end.',
  'Defer all "nice-to-have" features until the core is working.',
  'Prefer working software over comprehensive documentation.',
  'Commit working code every day — never let a session end with broken code.',
];

const FOOTER = [
  'This plan was generated deterministically from your project inputs.',
  'It is a starting point — adapt it to your specific situation.',
];

function resultsOf(ctx) {
  return ctx?.results || {};
}

function clampList(arr, fallback, n) {
  if (!Array.isArray(arr)) return fallback;
  const items = arr.map(s => String(s).trim()).filter(Boolean).slice(0, n);
  return items.length ? items : fallback;
}

/**
 * The ONE canonical brief model. Every renderer (screen text, markdown export)
 * derives from this object, so the two can never drift.
 *
 * Stage results are consumed structurally — no text slicing. Optional `llm`
 * (from the brief Gemini call) overrides the next-steps / MVP / story sections;
 * otherwise the bundled defaults are used so the brief always renders.
 */
export function buildBriefModel(ctx, llm) {
  const input = ctx?.input || {};
  const r = resultsOf(ctx);

  const gh = r.github;                       // { profile, languages, repos, badge }
  const feas = r.feasibility;                // { score, verdict, verdictClass, estimate, axes }
  const builder = r.builder;                 // { files, folder, text, milestones }
  const arch = r.architecture;               // { shape, modules, flow, principles }
  const research = r.research;               // { opportunities, risks, directions, builderSignal }
  const stack = r.stack;                     // { label, app, ui, api, data, ... }

  const stackLabel = resolveStackLabel({ stack: input.stack, customStack: input.customStack });
  const projectType = PROJECT_TYPES[input.type] || input.type || 'Not specified';
  const teamSize = TEAM_SIZES[input.team] || input.team || 'Solo';
  const profileName = gh?.profile ? `${gh.profile.name} (@${gh.profile.login})` : 'not provided';

  const llmUsed = !!(llm && (llm.nextSteps?.length || llm.mvpGuidance?.length || llm.story));
  const nextSteps = clampList(llm?.nextSteps, NEXT_STEPS, 4);
  const mvpGuidance = clampList(llm?.mvpGuidance, MVP_GUIDANCE, 4);
  const story = llm?.story ? String(llm.story).trim() : null;
  const footer = llmUsed
    ? ['This plan used an LLM to tailor the narrative sections to your idea.', 'It is a starting point — adapt it to your specific situation.']
    : FOOTER;

  const context = [
    { label: 'GitHub profile',  body: profileName },
    { label: 'Feasibility',     body: feas ? `${feas.score}/100 — ${feas.verdict}` : '—' },
    { label: 'Scaffold',        body: builder?.files?.length ? `${builder.files.length} files — download the scaffold (.zip)` : '—' },
    { label: 'Stack',           body: stack?.label || stackLabel },
    { label: 'Architecture',    body: arch?.shape || '—' },
    { label: 'Research signal', body: research?.directions?.[0] || '—' },
    { label: 'Deadline',        body: `${input.deadline || 'not specified'} · Comfort: ${input.comfort}` },
    { label: 'Project type',    body: `${projectType} · Team: ${teamSize}` },
  ];

  return {
    header: { project: input.idea || '—', owner: input.name || 'the builder' },
    context,
    nextSteps,
    mvpGuidance,
    footer,
    story,

    // Illuminated fields for the overview section of the markdown export.
    stackLabel,
    projectType,
    teamSize,
    ownerName: input.name || 'the builder',
    idea: input.idea || '—',
    audience: input.audience || '—',
    github: input.github || '—',
    deadline: input.deadline || '—',
    comfort: input.comfort || '—',
  };
}