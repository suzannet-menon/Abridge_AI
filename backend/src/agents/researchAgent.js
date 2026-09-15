import { hash, pick } from '../utils/hash.js';
import { runLLMStage, MODE } from '../services/gemini.js';
import { buildResearchPrompt } from '../prompts/prompts.js';

const OPPORTUNITIES = [
  'Small, focused tools with a single clear job tend to win over sprawling platforms.',
  'There is a steady market for fast, opinionated utilities that remove ceremony.',
  'Automation of recurring manual work remains underserved by most tooling.',
  'Teams pay for measurable time saved; the pitch should be concrete and numeric.',
  'The pattern of "input → structured output" generalizes well across domains.',
  'Developer-facing tools that integrate with existing workflows see faster adoption.',
  'Products that make complex workflows observable and predictable have strong retention.',
];

const RISKS = [
  'Feature creep is the top failure mode; scope to one sharp slice first.',
  'Existing incumbents often win on habit rather than capability.',
  'Solo-built tools struggle on support load; keep the surface area small.',
  'Integration friction with existing workflows is the most common adoption blocker.',
  'Underspecified inputs produce unreliable outputs; define inputs explicitly.',
  'Perfectionism before shipping is a common project killer — prefer iterative delivery.',
];

const DIRECTIONS = [
  'Lead with the fastest end-to-end vertical slice, then harden it.',
  'Ship a CLI first, then wrap it in a minimal web surface.',
  'Publish the deterministic core as a library so other tools can embed it.',
  'Make the pipeline observable: users should see each stage work.',
  'Design for offline-first; it removes a whole class of failure modes.',
  'Define a tight MVP with 3 features maximum, then add based on real usage.',
];

const FALLBACK_LINE = 'Re-validate this against a sharp, concrete use case before committing.';

/** Structured result shape every researcher returns: { opportunities, risks, directions, builderSignal, text }. */
function normalize(idea, gh, part) {
  const opportunities = clamp(part?.opportunities, 3, () => deterministicPicks(idea, gh, 'opp'));
  const risks = clamp(part?.risks, 3, () => deterministicPicks(idea, gh, 'risk'));
  const directions = clamp(part?.directions, 2, () => deterministicPicks(idea, gh, 'dir'));
  const builderSignal = part?.builderSignal && String(part.builderSignal).trim()
    ? String(part.builderSignal).trim()
    : `${gh?.languages?.[0]?.language || 'n/a'}-first builder, ${gh?.profile?.followers ?? 0} GitHub followers.`;

  const text = renderText({ project: idea, builderSignal, opportunities, risks, directions });
  return { opportunities, risks, directions, builderSignal, text };
}

function clamp(arr, n, fallback) {
  if (!Array.isArray(arr)) return fallback();
  const items = arr.map(x => String(x).trim()).filter(Boolean).slice(0, n);
  while (items.length < n) items.push(FALLBACK_LINE);
  return items;
}

function deterministicPicks(idea, gh, which) {
  const seed = hash((idea || '') + '|' + (gh?.profile?.login || '') + '|' + which);
  const pool = which === 'opp' ? OPPORTUNITIES : which === 'risk' ? RISKS : DIRECTIONS;
  const n = which === 'dir' ? 2 : 3;
  return pick(seed, pool, n);
}

function deterministic(idea, gh) {
  const oppSeed = hash((idea || '') + '|' + (gh?.profile?.login || ''));
  return {
    opportunities: pick(oppSeed, OPPORTUNITIES, 3),
    risks: pick(oppSeed ^ 0x9e3779b9, RISKS, 3),
    directions: pick(oppSeed ^ 0x85ebca6b, DIRECTIONS, 2),
  };
}

function renderText(r) {
  const lines = [
    `Project: ${r.project}`,
    `Builder signal: ${r.builderSignal}`,
    '',
    'Opportunity scan',
    ...r.opportunities.map((o, i) => `${i + 1}. ${o}`),
    '',
    'Risks to plan around',
    ...r.risks.map((x, i) => `${i + 1}. ${x}`),
    '',
    'Recommended direction',
    ...r.directions.map((d, i) => `${i + 1}. ${d}`),
  ];
  return lines.join('\n');
}

/**
 * Research stage. Uses the Gemini API when a key is configured (cached per
 * input hash); otherwise falls back to seeded pool picks. Always returns
 * structured { opportunities, risks, directions, builderSignal, text, mode }.
 */
export async function runResearchAgent(input, gh) {
  const idea = input.idea || '';
  const ghResolved = gh || { profile: { followers: 0 }, languages: [] };

  const seedKey = (idea || '') + '|' + (input.stack || '') + '|' + (input.type || '') +
    '|' + (input.deadline || '') + '|' + (ghResolved?.profile?.login || '');
  const llm = await runLLMStage('research:' + seedKey, buildResearchPrompt(input, ghResolved));

  if (llm.ok) {
    const data = normalize(idea, ghResolved, {
      opportunities: llm.data.opportunities,
      risks: llm.data.risks,
      directions: llm.data.directions,
      builderSignal: llm.data.builderSignal,
    });
    return { ...data, mode: llm.mode };
  }

  return { ...normalize(idea, ghResolved, deterministic(idea, ghResolved)), mode: MODE.DETERMINISTIC };
}