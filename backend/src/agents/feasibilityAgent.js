import { hash, pick } from '../utils/hash.js';
import { STACKS } from '../domain/stacks.js';
import { PROJECT_TYPES, TEAM_SIZES } from '../domain/types.js';
import { parseDeadline, deadlineScore } from '../domain/deadline.js';

const FEAS_RISKS = [
  { risk: 'Feature creep pulls the timeline out.', fix: 'Freeze scope after the foundation phase and ship the vertical slice.' },
  { risk: 'Integration friction with existing workflows blocks adoption.', fix: 'Design a paste-ready output and a copyable CLI from day one.' },
  { risk: 'Underspecified inputs produce unreliable outputs.', fix: 'Define the input contract explicitly in the first milestone.' },
  { risk: 'Solo support load grows faster than the feature set.', fix: 'Keep the surface area small; automate errors and self-help.' },
  { risk: 'The stack is unfamiliar at this comfort level.', fix: 'Use the scaffolded starter files and step-by-step notes for the first week.' },
  { risk: 'Deadline is tight relative to scope.', fix: 'Scope down to a strict MVP; defer everything non-essential to v2.' },
  { risk: 'Real-world input messiness blows the parsing estimate.', fix: 'Hard-code a small fixture suite of messy real inputs before the core is done.' },
  { risk: 'Packaging and distribution are forgotten until the end.', fix: 'Wire install, help, and error text into the foundation milestone.' },
  { risk: 'Ambiguous outcomes make the milestone "done" impossible to judge.', fix: 'Write a numeric done-when condition for every milestone.' },
  { risk: 'A mismatch between audience and the chosen workflow.', fix: 'Port one real workflow end-to-end before building any spare features.' },
];

function padScore(n, max) {
  let s = String(n);
  while (s.length < String(max).length) s = ' ' + s;
  return s + '/' + max;
}

export function runFeasibilityAgent(input) {
  const idea = String(input.idea || '').trim();
  const words = idea ? idea.split(/\s+/).length : 0;
  const audience = String(input.audience || '').trim();
  const comfort = input.comfort || 'beginner';
  const typeKey = PROJECT_TYPES[input.type] ? input.type : 'unsure';
  const teamKey = TEAM_SIZES[input.team] ? input.team : 'solo';
  const hasCustomStack = !!input.customStack;

  const deadline = parseDeadline(input.deadline);
  const days = deadline.days;

  // Five scoring axes
  const clarity    = Math.min(30, Math.floor(words * 0.5) + (audience ? 3 : 0));
  const stackFit   = comfort === 'advanced' ? 25 : comfort === 'intermediate' ? 20 : 15;
  const scope      = { tool: 20, 'data-pipeline': 18, service: 15, 'web-app': 14, unsure: 10 }[typeKey] ?? 10;
  const time       = deadlineScore(deadline);
  const builderFit = (input.stack && input.stack !== 'unsure') || hasCustomStack ? 10 : 6;

  const score = Math.max(0, Math.min(100, clarity + stackFit + scope + time + builderFit));

  let verdictClass, verdict, verdictMsg, recommendation;
  if (score >= 70) {
    verdictClass = 'good'; verdict = 'GO';
    verdictMsg = 'Worth building now — scope and stack line up with a realistic path.';
    recommendation = 'Start with the MVP slice defined in the builder plan. Ship something runnable in week 2.';
  } else if (score >= 50) {
    verdictClass = 'warn'; verdict = 'Proceed with caution';
    verdictMsg = 'Buildable — tighten scope or extend the deadline before committing.';
    recommendation = 'Pick 2–3 core features only. Defer everything else to v2. Revisit the deadline.';
  } else {
    verdictClass = 'bad'; verdict = 'Rethink / reshape';
    verdictMsg = 'Too much surface for the current setup — reshape the scope first.';
    recommendation = 'Redefine the idea as a single, sharp use case. Remove unknowns before committing to build.';
  }

  if (days != null && days <= 7) {
    recommendation += ' This reads as a sprint, not a buildout — cut scope to one vertical slice that ships inside the window.';
  }

  const estimate = score >= 75 ? 'Lean' : score >= 55 ? 'Medium' : 'Large';
  const weeks    = score >= 75 ? '1–2'  : score >= 55 ? '3–5'   : '6–10';

  const tight = days != null && days <= 14;
  const teamLabel = TEAM_SIZES[teamKey] || 'Solo';
  const estimateLine = tight
    ? `Effort estimate: fits your ${days}‑day deadline as a tight MVP (${teamLabel}) — full version realistically ~${weeks} weeks`
    : `Effort estimate: ${estimate} — ~${weeks} weeks (${teamLabel})`;
  const estimateField = tight
    ? `fits your ${days}‑day deadline as a tight MVP (full version ~${weeks} weeks)`
    : `${estimate} — ~${weeks} weeks`;

  const seed = hash((input.idea || '') + '|' + (input.stack || '') + '|' + (input.customStack || '') + '|' + comfort + '|' + (input.deadline || '') + '|' + typeKey + '|' + (input.audience || '') + '|' + (input.team || ''));
  const risks = pick(seed, FEAS_RISKS, 3);

  const stackLabel = hasCustomStack
    ? input.customStack
    : (input.stack && STACKS[input.stack] && input.stack !== 'unsure' ? STACKS[input.stack].label : 'default stack');

  const lines = [
    `Feasibility Score: ${score}/100`,
    `Verdict: ${verdict}`,
    `Summary: ${verdictMsg}`,
    '',
    'Score breakdown',
    `  Idea clarity   ${padScore(clarity, 30)}  (${words} words${audience ? ' · audience: yes' : ''})`,
    `  Stack fit      ${padScore(stackFit, 25)}  (${comfort})`,
    `  Scope          ${padScore(scope, 20)}  (${(PROJECT_TYPES[typeKey] || typeKey).toLowerCase()})`,
    `  Time realism   ${padScore(time, 15)}  (${deadline.label})`,
    `  Builder fit    ${padScore(builderFit, 10)}  (${stackLabel})`,
    '',
    estimateLine,
    '',
    'Recommendation',
    `  ${recommendation}`,
    '',
    'Key risks & mitigations',
    ...risks.flatMap((r, i) => [`  ${i + 1}. ${r.risk}`, `     Mitigation: ${r.fix}`]),
    '',
    '> Note: This score is a planning estimate, not a scientific measure. Use it as a starting point for scoping conversations.',
  ];

  return {
    score,
    verdict,
    verdictClass,
    estimate: estimateField,
    axes: [
      { label: 'Idea clarity',  value: clarity,    max: 30 },
      { label: 'Stack fit',     value: stackFit,   max: 25 },
      { label: 'Scope',         value: scope,      max: 20 },
      { label: 'Time realism',  value: time,       max: 15 },
      { label: 'Builder fit',   value: builderFit, max: 10 },
    ],
    text: lines.join('\n'),
  };
}