import { STACKS } from '../domain/stacks.js';
import { parseCustomStack, CATEGORY_LABELS, starterLanguageFor } from '../domain/techs.js';

const STARTER_LABELS = { typescript: 'TypeScript / JavaScript', python: 'Python', go: 'Go', rust: 'Rust' };
const STARTER_TOKENS = {
  typescript: ['node', 'nodejs', 'bun', 'deno', 'javascript', 'typescript'],
  python: ['python', 'fastapi', 'flask', 'django'],
  go: ['go', 'golang', 'gin', 'echo'],
  rust: ['rust', 'axum', 'actix'],
};

export function runTechStackAgent(input) {
  const hasCustomStack = !!input.customStack;
  const comfort = input.comfort || 'beginner';

  const comfortNote =
    comfort === 'advanced'     ? 'skip guardrails, add CI + benchmarks early'
    : comfort === 'intermediate' ? 'add small tests per module, keep it boring'
    :                              'prefer scaffolding + step-by-step notes, one feature at a time';

  if (hasCustomStack) {
    const { components, unknown } = parseCustomStack(input.customStack);

    const byCategory = new Map();
    components.forEach(c => {
      if (!byCategory.has(c.category)) byCategory.set(c.category, []);
      byCategory.get(c.category).push(c.label);
    });

    const compLines = [...byCategory.entries()].map(([cat, labels]) => {
      const catLabel = CATEGORY_LABELS[cat] || cat;
      return `  ${catLabel.padEnd(16)} ${labels.join(', ')}`;
    });

    const unknownLines = unknown.length
      ? ['', '  Not yet recognized (will be noted in the scaffold):', ...unknown.map(u => `    • ${u}`)]
      : [];

    const base = starterLanguageFor(input);
    const baseLabel = STARTER_LABELS[base] || base;
    const runtimeTokens = components.filter(c => c.category === 'runtime').map(c => c.token);
    const matchedToken = runtimeTokens.length
      ? (STARTER_TOKENS[base] || []).some(t => runtimeTokens.includes(t))
      : base !== 'typescript';
    const starterNote = matchedToken
      ? `The starter scaffold matches your stack (${baseLabel} base).`
      : `No bundled starter for ${runtimeTokens.join(' + ') || 'your stack'} — the scaffold uses the ${baseLabel} default; adapt the files to match.`;

    const lines = [
      `Stack: ${input.customStack} (custom)`,
      '',
      'Custom stack detected — rendered as components:',
      ...compLines,
      ...unknownLines,
      '',
      'General guidance for custom stacks:',
      '  • Verify all components have compatible versions before starting.',
      '  • Check community health: documentation quality, open issues, release cadence.',
      '  • Build a minimal integration proof before committing to the full stack.',
      '  • Prefer packages with >1k GitHub stars and active maintenance.',
      '',
      `Pace (${comfort}): ${comfortNote}`,
      '',
      `Note: ${starterNote}`,
    ];
    return {
      label: input.customStack,
      custom: true,
      components: components.map(c => ({ label: c.label, category: c.category })),
      starterNote,
      pace: comfortNote,
      text: lines.join('\n'),
    };
  }

  const key = input.stack || 'unsure';
  const s = STACKS[key] || STACKS.unsure;

  const lines = [
    `Stack: ${s.label}`,
    `  app     ${s.app}`,
    `  ui      ${s.ui}`,
    `  api     ${s.api}`,
    `  data    ${s.data}`,
    `  test    ${s.test}`,
    `  lint    ${s.lint}`,
    '',
    `Why: ${s.why}`,
    `Pace (${comfort}): ${comfortNote}`,
  ];

  return { label: s.label, app: s.app, ui: s.ui, api: s.api, data: s.data, test: s.test, lint: s.lint, why: s.why, pace: comfortNote, text: lines.join('\n') };
}