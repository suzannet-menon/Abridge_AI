/**
 * Prompt builders for the Gemini-capable stages (research, architecture,
 * builder, brief). These are the contract between the app and the model:
 * the strict JSON shapes here are exactly what the stage agents consume, and
 * every prompt tells the model to be concrete and idea-specific so output is
 * never generic. A no-key API failure always falls back to the bundled agents.
 */

function jsonShape(name, example) {
  return `Return ONLY strict JSON matching this shape (no markdown fences, no commentary, no extra keys):\n${JSON.stringify(example, null, 2)}`;
}

/** Research stage prompt: market signal scan for THIS idea. */
export function buildResearchPrompt(input, gh) {
  const languages = gh?.languages?.length
    ? gh.languages.slice(0, 5).map(l => `${l.language} (${l.count} repos)`).join(', ')
    : 'no public repo data (sample fallback)';

  return `You are a research analyst inside a project-planning studio. A developer submitted a project idea. Produce a short, concrete, independent research brief for THIS idea.

Project idea: "${input.idea}"
Project type: ${input.type || 'not specified'}
Target audience: ${input.audience || 'not specified'}
Deadline: ${input.deadline || 'not specified'}
Builder comfort level: ${input.comfort || 'not specified'}
Builder's top GitHub languages: ${languages}

${jsonShape('research brief', {
    opportunities: ['...', '...', '...'],
    risks: ['...', '...', '...'],
    directions: ['...', '...'],
    builderSignal: '...',
  })}

Rules:
- Exactly 3 opportunities, 3 risks, 2 directions, 1 builderSignal.
- Every item MUST reference this specific idea, its type, audience, or deadline. One sentence, max 24 words, no leading numbering.
- Forbidden filler phrases: "build a vertical slice", "scope carefully", "iterate quickly", "define an MVP" — say something specific instead.
- Be realistic. Never invent market data, competitors, or facts about the user.
- builderSignal: one sentence tying the builder's language history (or its absence) to the idea.`;
}

/** Architecture stage prompt: module + data-flow blueprint for THIS idea. */
export function buildArchitecturePrompt(input, ctx) {
  const research = ctx?.results?.research || {};
  return `You are a software architect inside a project-planning studio. Design a concrete module and data-flow blueprint for THIS idea only.

Project idea: "${input.idea}"
Project type: ${input.type || 'not specified'}
Target audience: ${input.audience || 'not specified'}
Deadline: ${input.deadline || 'not specified'}
Builder comfort level: ${input.comfort || 'not specified'}
Research direction already found: ${research.directions?.[0] || 'not researched yet'}

${jsonShape('architecture blueprint', {
    shape: 'one-line architecture shape, e.g. "ingest -> normalize -> generate -> deliver"',
    modules: ['module name', 'module name', 'module name', 'module name'],
    flow: 'one-line description of how data moves through the modules',
    principles: ['design principle', 'design principle', 'design principle'],
  })}

Rules:
- Exactly 4 modules, 1 flow, 3 principles, 1 shape.
- Module names and the flow MUST be derived from the specific idea (e.g. "inventory adapter", "post renderer"), never the generic pool list like "core / domain logic".
- Each principle one sentence, max 20 words, tied to this idea's risks.
- One module is the pure, deterministic "core" that holds all business logic; the rest are thin adapters around it.
- shape is one short line (max 8 tokens, arrows optional).`;
}

/** Builder stage prompt: tailored milestone plan + overview (scaffold stays bundled). */
export function buildBuilderPrompt(input, ctx) {
  const stack = ctx?.results?.stack || {};
  const arch = ctx?.results?.architecture || {};
  const feas = ctx?.results?.feasibility || {};
  const research = ctx?.results?.research || {};
  const modules = (arch.modules || []).join(', ') || 'not decided yet';
  return `You are an implementation coach inside a project-planning studio. Write a 4-week build plan for THIS idea, mapped onto the architecture that was already designed.

Project idea: "${input.idea}"
Project type: ${input.type || 'not specified'}
Deadline: ${input.deadline || 'not specified'}
Builder comfort level: ${input.comfort || 'not specified'}
Chosen stack: ${stack.label || input.customStack || 'not decided yet'}
Feasibility: ${feas ? `${feas.score}/100 — ${feas.verdict}` : '—'}
Architecture shape: ${arch.shape || 'not decided yet'}
Architecture modules: ${modules || 'not decided yet'}
Research direction: ${research.directions?.[0] || 'not researched yet'}

${jsonShape('build plan', {
    overview: '2-3 sentence build overview tied directly to the idea',
    milestones: [
      { week: 1, title: 'Short title', tasks: ['task', 'task'], accept: 'concrete done-when condition' },
      { week: 2, title: 'Short title', tasks: ['task', 'task', 'task'], accept: 'concrete done-when condition' },
      { week: 3, title: 'Short title', tasks: ['task', 'task', 'task'], accept: 'concrete done-when condition' },
      { week: 4, title: 'Short title', tasks: ['task', 'task'], accept: 'concrete done-when condition' },
    ],
  })}

Rules:
- Exactly 4 milestones with weeks 1, 2, 3, 4 in order (integers only).
- Title is a short project-specific name (e.g. "Rule Engine", "Intake & Matching") — never the generic "Foundation / Core slice / Harden / Ship".
- Tasks and done-when conditions MUST reference THIS idea's inputs, outputs, and the architecture module names above. Every milestone must name at least one of: ${modules || 'a module from the architecture'}.
- 2-4 tasks per milestone, each one actionable sentence referencing a deliverable (max 14 words).
- overview mentions the idea's core value, the first slice to ship, and stays realistic for the deadline.`;
}

/** Brief stage prompt: tailors the written brief sections (context stays structured). */
export function buildBriefPrompt(ctx) {
  const input = ctx?.input || {};
  const r = ctx?.results || {};
  return `You are a project-brief writer. Given a finished analysis, write the narrative sections of an implementation plan for THIS project.

Project idea: "${input.idea}"
Owner: ${input.name || 'the builder'}
Audience: ${input.audience || 'not specified'}
Deadline: ${input.deadline || 'not specified'}
Feasibility: ${r.feasibility ? `${r.feasibility.score}/100 — ${r.feasibility.verdict}` : '—'}
Stack: ${r.stack?.label || input.customStack || '—'}
Architecture: ${r.architecture?.shape || '—'}
Research signal: ${r.research?.directions?.[0] || '—'}
Research opportunities: ${(r.research?.opportunities || []).join(' | ') || '—'}
Planned milestones: ${(r.builder?.milestones || []).map(m => `W${m.week} ${m.title}`).join(', ') || '—'}

${jsonShape('brief sections', {
    story: 'one paragraph (4-6 sentences) tying the idea, feasibility verdict, and research signal together',
    nextSteps: ['...', '...', '...', '...'],
    mvpGuidance: ['...', '...'],
  })}

Rules:
- story is 4-6 sentences, idea-specific, matching the verdict tone (GO / caution / rethink).
- Exactly 4 next steps, each one concrete sentence (max 16 words) ordered from first action onward.
- Exactly 2 mvp-scope rules that reference THIS idea's core deliverable.
- Never mention "this plan was generated deterministically".`;
}

/** Legacy alias so existing imports keep working during migration. */
export const buildResearchPromptLegacy = buildResearchPrompt;