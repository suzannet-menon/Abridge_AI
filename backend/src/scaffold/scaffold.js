import { STACKS, resolveStackLabel } from '../domain/stacks.js';
import { PROJECT_TYPES } from '../domain/types.js';
import { parseCustomStack, CATEGORY_LABELS, starterLanguageFor } from '../domain/techs.js';

export function slugify(str) {
  return String(str || 'project').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'project';
}

function filePurpose(path) {
  const name = path.split('/').pop();
  const map = {
    'package.json': 'scripts, dev deps, module config',
    'tsconfig.json': 'strict TypeScript config',
    'pyproject.toml': 'project metadata, deps, pytest + ruff config',
    'go.mod': 'module definition',
    'Cargo.toml': 'crate metadata and deps',
    'index.ts': 'entry point — parse input, run core, print output',
    'main.py': 'entry point — Typer CLI over the core',
    'main.go': 'entry point — parse args, run core',
    'main.rs': 'entry point — parse args, run core',
    'core.ts': 'pure deterministic core — implement the real transform here',
    'core.py': 'pure deterministic core — implement the real transform here',
    'core.go': 'pure deterministic core — implement the real transform here',
    'core.rs': 'pure deterministic core — implement the real transform here',
    'core.test.ts': 'first unit test for the core',
    'test_core.py': 'first unit test for the core',
    'core_test.go': 'first unit test for the core',
    '__init__.py': 'package marker',
    'README.md': 'idea, why, architecture, stack rationale, dependencies, quick start',
    'PLAN.md': 'feasibility summary + implementation milestones',
    'sample-input.txt': 'sample fixture of the real input this tool must handle',
    '.gitignore': 'ignore build artifacts',
  };
  return map[name] || 'project file';
}

// ── Stack-specific setup docs (commands, deps) ─────────────────────────────
const STACK_DOCS = {
  typescript: {
    depsHeader: 'package.json (devDependencies)',
    deps: ['typescript ^5.5 — compiler', 'vitest ^2.1 — unit tests', 'biome ^1.9 — lint + format', '@types/node ^22 — Node typings'],
    commands: { install: 'npm install', build: 'npm run build', run: 'npm run build && node dist/index.js "<input>"', test: 'npm test', lint: 'npm run lint' },
  },
  python: {
    depsHeader: 'pyproject.toml',
    deps: ['typer >=0.12 — CLI framework', 'pytest — unit tests', 'ruff — lint + format'],
    commands: { install: 'uv sync', build: '', run: '<slug> "<input>"', test: 'uv run pytest', lint: 'uv run ruff check' },
  },
  go: {
    depsHeader: 'go.mod (stdlib only)',
    deps: ['testing (stdlib) — unit tests', 'gofmt — formatting'],
    commands: { install: 'go mod tidy', build: 'go build .', run: 'go run . "<input>"', test: 'go test ./...', lint: 'gofmt -l .' },
  },
  rust: {
    depsHeader: 'Cargo.toml',
    deps: ['cargo clippy — lint', 'cargo fmt — formatting'],
    commands: { install: 'cargo build', build: 'cargo build', run: 'cargo run -- "<input>"', test: 'cargo test', lint: 'cargo clippy' },
  },
};

function docFor(stackKey, slug) {
  const d = STACK_DOCS[stackKey] || STACK_DOCS.typescript;
  return { ...d, deps: d.deps.slice(), run: d.commands.run.replace('<slug>', slug) };
}

// ── Small ASCII flow diagram built from the architecture shape ─────────────
function flowDiagram(shapeSteps) {
  const steps = (Array.isArray(shapeSteps) && shapeSteps.length ? shapeSteps : ['input', 'parse', 'transform', 'output']).slice(0, 7);
  const lines = ['```text'];
  steps.forEach((s, i) => {
    lines.push(`  ▸ ${s}`);
    if (i < steps.length - 1) lines.push('    │');
    if (i < steps.length - 1) lines.push('    ▼');
  });
  lines.push('```');
  return lines.join('\n');
}

function archFrom(ctx) {
  const r = ctx?.results || {};
  const arch = r.architecture || {};
  const shape = arch.shape || 'input → parse → transform → output';
  const steps = shape.split(/\s*(?:->|→|=>)\s*/).map(s => String(s).trim()).filter(Boolean);
  return { arch, shape, steps };
}

function stackLabelFor(input, stackKey) {
  const meta = STACKS[stackKey] || STACKS.typescript;
  return input.customStack || resolveStackLabel(input) || meta.label || 'TypeScript / JavaScript';
}

function milestonesFor(ctx, fallback) {
  const r = ctx?.results || {};
  const m = Array.isArray(r.builder?.milestones) && r.builder.milestones.length ? r.builder.milestones : fallback;
  return m.slice(0, 6);
}

function fallbackMilestones(shape) {
  const core = 'the core module';
  return [
    { week: 1, title: 'Foundation', tasks: ['Scaffold the repo from the starter files.', 'Wire build, test, and lint scripts.', 'Add fixtures for the first input sample.'], accept: 'the repo builds and the placeholder test passes.' },
    { week: 2, title: 'Core slice', tasks: [`Implement the main ${shape} flow in ${core}.`, 'Connect the entry point to the core.'], accept: 'running the entry point on the sample input produces the expected output.' },
    { week: 3, title: 'Harden', tasks: ['Add error taxonomy and edge-case handling.', 'Unit-test every module with fixed fixtures.'], accept: 'all tests are green and failures are clear and actionable.' },
    { week: 4, title: 'Ship', tasks: ['Write docs and a README quick start.', 'Tag a release.'], accept: 'a fresh clone builds and runs straight from the README.' },
  ];
}

// ── README.md — proper project readme, generated from the pipeline ─────────
// ── Native toolchains for custom stacks (C/C++/Rust/C# etc.) ───────────────
const NATIVE_TOOLCHAINS = {
  c:      { label: 'C',         req: 'C17 compiler + CMake >= 3.16' },
  cpp:    { label: 'C++',       req: 'C++17 compiler + CMake >= 3.16' },
  cxx:    { label: 'C++',       req: 'C++17 compiler + CMake >= 3.16' },
  csharp: { label: 'C# / .NET', req: '.NET SDK 8+ (LTS)' },
  dotnet: { label: 'C# / .NET', req: '.NET SDK 8+ (LTS)' },
  rust:   { label: 'Rust',      req: 'Rust toolchain (rustup)' },
};

function nativeDepLines(components) {
  const seen = new Set();
  const lines = [];
  for (const c of components) {
    const t = NATIVE_TOOLCHAINS[c.token];
    if (!t || seen.has(t.label)) continue;
    seen.add(t.label);
    lines.push(
      `- \`${t.req}\` — the planned **${t.label}** component. The scaffold seeds a ` +
      'free-standing slice that runs without it; call the native piece as a ' +
      'subprocess from the CLI (or bind it in a later milestone).'
    );
  }
  return lines;
}

function stackTableRows(input, stackKey) {
  if (input.customStack) {
    const { components } = parseCustomStack(input.customStack);
    const byCategory = new Map();
    components.forEach(c => {
      if (!byCategory.has(c.category)) byCategory.set(c.category, []);
      byCategory.get(c.category).push(c.label);
    });
    if (byCategory.size) {
      const rows = [...byCategory.entries()]
        .map(([cat, labels]) => `| ${CATEGORY_LABELS[cat] || cat} | ${labels.join(', ')} |`);
      rows.push(`| Note | Custom combination — pin versions and verify compatibility manually |`);
      return rows.join('\n');
    }
  }
  const stackMeta = STACKS[stackKey] || STACKS.typescript;
  return [
    ['Runtime / app', stackMeta.app],
    ['UI', stackMeta.ui],
    ['API', stackMeta.api],
    ['Data', stackMeta.data],
    ['Tests', stackMeta.test],
    ['Lint', stackMeta.lint],
  ].map(([k, v]) => `| ${k} | ${v} |`).join('\n');
}

function readmeMarkdown({ input, ctx, stackKey, slug }) {
  const r = ctx?.results || {};
  const feas = r.feasibility || {};
  const stackMeta = STACKS[stackKey] || STACKS.typescript;
  const { shape, steps } = archFrom(ctx);
  const stackLabel = stackLabelFor(input, stackKey);
  const typeLabel = PROJECT_TYPES[input.type] || input.type || 'Web app';
  const name = input.name || slug;
  const idea = input.idea || '—';
  const docs = docFor(stackKey, slug);
  const milestones = milestonesFor(ctx, fallbackMilestones(shape));

  const stackTable = stackTableRows(input, stackKey);
  const customWhy = input.customStack
    ? `You specified a custom combination: **${stackLabel}**.`
    : `**${stackLabel}** was chosen because: *${stackMeta.why}*`;

  const { components } = input.customStack ? parseCustomStack(input.customStack) : { components: [] };
  const baseLabel = STACKS[stackKey]?.label || stackKey;
  const nativeLines = nativeDepLines(components);
  const otherRuntimes = components
    .filter(c => c.category === 'runtime' && c.label !== baseLabel)
    .map(c => c.label);
  const runtimeNote = input.customStack
    ? `The generated files wire the **${baseLabel}** slice so the project runs locally today.`
      + (otherRuntimes.length
        ? ` Components planned but not yet scaffolded — **${otherRuntimes.join(' + ')}** — need their own toolchain below.`
        : '')
    : 'No runtime dependencies are required for the MVP; everything runs on the\nstandard library/toolchain beyond these dev tools.';
  const nativeBlock = nativeLines.length
    ? ['', 'Planned native components:', '', ...nativeLines].join('\n')
    : '';
  const fixturePath = stackKey === 'typescript' ? 'test/fixtures/sample-input.txt' : 'fixtures/sample-input.txt';

  const milestoneBlock = milestones
    .map((m, i) => `- **Milestone ${i + 1} — ${m.slot || `Week ${m.week}`}: ${m.title}** — ${(m.tasks || []).join(' · ')}`)
    .join('\n');

  const modList = (Array.isArray(r.architecture?.modules) && r.architecture.modules.length
    ? r.architecture.modules : ['entry', 'core', 'output'])
    .map((m, i) => `${i + 1}. **${m}**`).join('\n');

  const principles = (Array.isArray(r.architecture?.principles) && r.architecture.principles.length
    ? r.architecture.principles : ['Keep the core pure and deterministic.', 'Thin adapters around the core.'])
    .map(p => `- ${p}`).join('\n');

  const buildRow = docs.commands.build ? `| Build | \`${docs.commands.build}\` |\n` : '';

  return `# ${name}

> ${idea}

AbridgeAI generated this repository from its planning pipeline. It is a
**starting scaffold**, not production-ready software — structure, tests, and
build are wired; the real logic is yours to implement (follow PLAN.md).

---

## 1. What is this?

**${name}** is a **${typeLabel}** built with **${stackLabel}**.

${idea}

Data-flow spine: \`${shape}\`.

---

## 2. Why build it?

| Signal | Value |
|---|---|
| Feasibility | ${feas.score != null ? `${feas.score}/100 — ${feas.verdict}` : 'run the plan to compute'} |
| Effort | ${feas.estimate || 'run the plan to compute'} |
| Architecture | \`${shape}\` |
| Immediate goal | Prove the input → output path end-to-end first |

Every module is deliberately small and deterministic; adapters (CLI, server,
UI) stay thin wrappers around the core.

---

## 3. Architecture

### Data flow

${flowDiagram(steps)}

### Modules

${modList}

### Design principles

${principles}

---

## 4. Why this stack?

${customWhy}

| Layer | Choice |
|-------|--------|
${stackTable}

**Trade-offs**

- Fast to iterate, with first-class tooling.
- Each layer (app/api/data) can be swapped independently as the project grows.

---

## 5. Dependencies to install

The project uses ${docs.depsHeader}:

${docs.deps.map(d => `- \`${d}\``).join('\n')}

${runtimeNote}
${nativeBlock}

---

## 6. Getting started

| Step | Command |
|------|---------|
| Install | \`${docs.commands.install}\` |
${buildRow}| Run | \`${docs.commands.run}\` |
| Test | \`${docs.commands.test}\` |
| Lint | \`${docs.commands.lint}\` |

Example:

\`\`\`bash
${docs.commands.run}
\`\`\`

---

## 7. What's in here?

- \`src/core\` — the pure, deterministic core (implement the real logic here).
- \`src/index\` (or \`main\`) — the CLI entry point.
- \`test/\` — the first unit tests. Run them before writing anything new.
- \`${fixturePath}\` — one sample of the input this tool must handle.
- \`PLAN.md\` — feasibility summary, architecture, and milestones.

---

## 8. Implementation plan

${milestoneBlock}

See **PLAN.md** for the full plan with tasks, acceptance criteria, and
feasibility notes.

---

*Built with [AbridgeAI](https://github.com/suzannet-menon/AbridgeAI) — from
rough idea to build-ready plan.*
`;
}

// ── PLAN.md — the full pipeline plan, embedded in the scaffold ─────────────
function planMarkdown({ input, ctx, stackKey, slug }) {
  const r = ctx?.results || {};
  const feas = r.feasibility || {};
  const builder = r.builder || {};
  const { shape, steps } = archFrom(ctx);
  const stackLabel = stackLabelFor(input, stackKey);
  const typeLabel = PROJECT_TYPES[input.type] || input.type || 'Web app';
  const idea = input.idea || '—';
  const name = input.name || slug;
  const milestones = milestonesFor(ctx, fallbackMilestones(shape));
  const axes = Array.isArray(feas.axes) ? feas.axes : [];

  const lines = [
    `# ${name} — Build Plan`,
    '',
    `> **Idea:** ${idea}`,
    '',
    '## 1. Feasibility',
    '',
    feas.score != null
      ? `- **Score:** ${feas.score}/100 — **${feas.verdict}**`
      : '- **Score:** _not computed in this run_',
    feas.estimate ? `- **Effort:** ${feas.estimate}` : null,
    '',
    ...(axes.length
      ? ['| Axes | Score |', '|------|-------|', ...axes.map(a => `| ${a.label} | ${a.value}/${a.max} |`), '']
      : []),
    '',
    builder.overview ? `**Overview:** ${builder.overview}` : null,
    '',
    '## 2. Architecture',
    '',
    '### Data flow',
    '',
    `\`${shape}\``,
    '',
    flowDiagram(steps),
    '',
    '### Modules',
    '',
    ...(Array.isArray(r.architecture?.modules) && r.architecture.modules.length
      ? r.architecture.modules.map((m, i) => `${i + 1}. ${m}`)
      : ['1. entry', '2. core', '3. output']),
    '',
    ...((Array.isArray(r.architecture?.principles) && r.architecture.principles.length)
      ? ['### Design principles', '', ...r.architecture.principles.map(p => `- ${p}`), '']
      : []),
    '## 3. Milestones',
    '',
    ...milestones.flatMap((m, i) => [
      `### Milestone ${i + 1} — ${m.slot || `Week ${m.week}`}: ${m.title}`,
      '',
      ...(Array.isArray(m.tasks) ? m.tasks.map(t => `- [ ] ${t}`) : []),
      '',
      `- **Done when:** ${m.accept || 'this milestone is verifiably complete.'}`,
      '',
    ]),
    '## 4. Getting started',
    '',
    `- **Type:** ${typeLabel} (${stackLabel}).`,
    '- Follow README.md for install / run / test instructions.',
    '- Start with the core module and the first unit test.',
    '- Re-run this plan in AbridgeAI whenever the idea changes.',
    '',
  ].filter(l => l != null);

  return lines.join('\n');
}

// ── Project plan context embedded into starter files ────────────────────────
function planContext(input, ctx, slug) {
  const r = ctx?.results || {};
  const arch = r.architecture || {};
  const { shape } = archFrom(ctx);
  const modules = Array.isArray(arch.modules) && arch.modules.length
    ? arch.modules : ['entry', 'core', 'output'];
  const principles = Array.isArray(arch.principles) && arch.principles.length
    ? arch.principles : ['Keep the core pure and deterministic.', 'Thin adapters around the core.'];
  return {
    name: input.name || slug,
    idea: input.idea || 'A deterministic tool.',
    shape,
    modules,
    principles,
  };
}

function fixtureSample() {
  return `<one real sample of the raw input this tool must handle>

This fixture is the contract your core must consume. Replace it with a real
example from your own use case before implementing the transform.`;
}

function planHeaderBlock(p) {
  return [
    `// ${p.name} — ${p.idea}`,
    '// Pure, deterministic core. No I/O, no side effects — everything the tool',
    '// prints flows through this module.',
    '//',
    '// Pipeline planned for this project:',
    `//   ${p.shape}`,
    '//',
    '// Modules to build (from the architecture stage):',
    ...p.modules.map((m, i) => `//   ${i + 1}. ${m}`),
    '//',
    '// Principles:',
    ...p.principles.map(x => `//   • ${x}`),
    '//',
    '// Start at the first step of the spine and keep each step pure and tested.',
  ].join('\n');
}

function tsStarter(slug, name, desc, p) {
  const pkg = {
    name: slug, version: '0.1.0', private: true, type: 'module', description: desc,
    scripts: { build: 'tsc', test: 'vitest run', 'test:watch': 'vitest', lint: 'biome check src' },
    devDependencies: { typescript: '^5.5.0', vitest: '^2.1.0', '@types/node': '^22.0.0', '@biomejs/biome': '^1.9.0' },
  };
  const tsconfig = {
    compilerOptions: {
      target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext',
      strict: true, outDir: 'dist', rootDir: 'src',
      declaration: true, sourceMap: true, esModuleInterop: true, skipLibCheck: true,
    },
    include: ['src'],
  };
  return [
    { path: 'package.json', content: JSON.stringify(pkg, null, 2) + '\n' },
    { path: 'tsconfig.json', content: JSON.stringify(tsconfig, null, 2) + '\n' },
    {
      path: 'src/core.ts',
      content: `${planHeaderBlock(p)}\n\nexport function run(input: string): string {\n  // First slice of "${p.shape}": normalize raw input so downstream steps\n  // parse one consistent contract. Replace with the real transform.\n  return normalize(input);\n}\n\nfunction normalize(raw: string): string {\n  return raw.trim();\n}\n`,
    },
    {
      path: 'src/index.ts',
      content: `// ${name} — ${p.idea}\n// Entry point: read raw input from argv, run the deterministic core, print.\n// Usage: node dist/index.js "<raw input>"\n\nimport { run } from './core.js';\n\nfunction main() {\n  const input = process.argv.slice(2).join(' ');\n  process.stdout.write(run(input) + '\\n');\n}\n\nmain();\n`,
    },
    {
      path: 'test/core.test.ts',
      content: `import { describe, expect, it } from 'vitest';\nimport { run } from '../src/core.js';\n\ndescribe('core', () => {\n  it('normalizes the raw input', () => {\n    expect(run('  hello  ')).toBe('hello');\n  });\n});\n`,
    },
    { path: 'test/fixtures/sample-input.txt', content: fixtureSample() },
    { path: '.gitignore', content: 'node_modules/\ndist/\n*.log\n' },
  ];
}

function pyStarter(slug, name, desc, p) {
  return [
    {
      path: 'pyproject.toml',
      content: `[project]\nname = "${slug}"\nversion = "0.1.0"\ndescription = "${desc}"\nrequires-python = ">=3.12"\ndependencies = ["typer>=0.12"]\n\n[project.scripts]\n${slug} = "src.main:cli"\n\n[tool.pytest.ini_options]\naddopts = "-q"\n\n[tool.ruff]\nline-length = 100\n`,
    },
    { path: 'src/__init__.py', content: '' },
    {
      path: 'src/main.py',
      content: `"""Entry point — Typer CLI over the deterministic core."""\n\nfrom src.core import run\n\ndef cli():\n    import typer\n    app = typer.Typer()\n\n    @app.command()\n    def go(input_text: str):\n        """Run the pipeline over INPUT_TEXT."""\n        typer.echo(run(input_text))\n\n    app()\n\nif __name__ == "__main__":\n    cli()\n`,
    },
    {
      path: 'src/core.py',
      content: `"""${name} — ${p.idea}

Pure, deterministic core. No I/O, no side effects — everything the CLI prints
flows through this module.

Pipeline planned for this project:
    ${p.shape}

Modules to build (from the architecture stage):
    ${p.modules.map((m, i) => `${i + 1}. ${m}`).join('\n    ')}

Principles:
    ${p.principles.map(x => `• ${x}`).join('\n    ')}
"""

def run(input_text: str) -> str:
    """First slice of "${p.shape}": normalize the raw input.

    Replace with the real transform, keeping every step pure and tested.
    """
    return input_text.strip()
`,
    },
    {
      path: 'tests/test_core.py',
      content: `from src.core import run\n\ndef test_normalizes_whitespace():\n    assert run("  x  ") == "x"\n`,
    },
    { path: 'fixtures/sample-input.txt', content: fixtureSample() },
    { path: '.gitignore', content: '__pycache__/\n.venv/\n*.pyc\n' },
  ];
}

function goStarter(slug, name, desc, p) {
  const header = [
    `// Package core — ${name} (${p.idea})`,
    '//',
    '// Pure, deterministic core: no I/O, no side effects. Everything main',
    '// prints flows through Run.',
    '//',
    '// Pipeline planned for this project:',
    `//   ${p.shape}`,
    '//',
    '// Modules to build (from the architecture stage):',
    ...p.modules.map((m, i) => `//   ${i + 1}. ${m}`),
    '//',
  ].join('\n');
  return [
    { path: 'go.mod', content: `module ${slug}\n\ngo 1.22\n` },
    {
      path: 'main.go',
      content: `package main\n\nimport (\n  "fmt"\n  "os"\n  "strings"\n  "${slug}/core"\n)\n\nfunc main() {\n  input := strings.Join(os.Args[1:], " ")\n  fmt.Println(core.Run(input))\n}\n`,
    },
    {
      path: 'core/core.go',
      content: `${header}\n\npackage core\n\nimport "strings"\n\n// Run is the first slice of the planned spine: normalize the raw input.\n// Replace with the real transform, keeping every step pure and tested.\nfunc Run(input string) string {\n  return strings.TrimSpace(input)\n}\n`,
    },
    {
      path: 'core/core_test.go',
      content: `package core\n\nimport "testing"\n\nfunc TestRunTrimsWhitespace(t *testing.T) {\n  if got := Run("  x  "); got != "x" {\n    t.Fatalf("Run() = %q, want %q", got, "x")\n  }\n}\n`,
    },
    { path: 'fixtures/sample-input.txt', content: fixtureSample() },
    { path: '.gitignore', content: 'bin/\n*.exe\n' },
  ];
}

function rustStarter(slug, name, desc, p) {
  const header = [
    `//! ${name} — ${p.idea}`,
    '//! Pure, deterministic core: no I/O, no side effects. Everything main',
    '//! prints flows through this module.',
    '//!',
    '//! Pipeline planned for this project:',
    `//!   ${p.shape}`,
    '//!',
    '//! Modules to build (from the architecture stage):',
    ...p.modules.map((m, i) => `//!   ${i + 1}. ${m}`),
    '//!',
  ].join('\n');
  return [
    {
      path: 'Cargo.toml',
      content: `[package]\nname = "${slug}"\nversion = "0.1.0"\nedition = "2021"\n\ndescription = "${desc}"\n\n[dependencies]\n`,
    },
    {
      path: 'src/main.rs',
      content: `mod core;\n\nfn main() {\n  let input: Vec<String> = std::env::args().skip(1).collect();\n  println!("{}", core::run(&input.join(" ")));\n}\n`,
    },
    {
      path: 'src/core.rs',
      content: `${header}\npub fn run(input: &str) -> String {\n  // First slice of the planned spine: normalize the raw input.\n  input.trim().to_string()\n}\n\n#[cfg(test)]\nmod tests {\n  use super::*;\n\n  #[test]\n  fn run_trims_whitespace() {\n    assert_eq!(run("  x  "), "x");\n  }\n}\n`,
    },
    { path: 'fixtures/sample-input.txt', content: fixtureSample() },
    { path: '.gitignore', content: '/target\n' },
  ];
}

export function scaffoldFiles(input, slug, ctx) {
  const name = input.name || slug;
  const desc = input.idea || 'A deterministic tool.';
  const lang = starterLanguageFor(input);
  const stackKey = ['python', 'go', 'rust'].includes(lang) ? lang : 'typescript';
  const p = planContext(input, ctx, slug);

  let starter;
  if (stackKey === 'python') starter = pyStarter(slug, name, desc, p);
  else if (stackKey === 'go') starter = goStarter(slug, name, desc, p);
  else if (stackKey === 'rust') starter = rustStarter(slug, name, desc, p);
  else starter = tsStarter(slug, name, desc, p);

  const ctxForDocs = { input, ctx, stackKey, slug };
  const plan = { path: 'PLAN.md', content: planMarkdown(ctxForDocs) };
  const readme = { path: 'README.md', content: readmeMarkdown(ctxForDocs) };

  return [plan, readme, ...starter];
}

export function getScaffoldTree(files, rootName) {
  const root = {};
  files.forEach(f => {
    const parts = f.path.split('/');
    let node = root;
    parts.forEach(part => { if (!node[part]) node[part] = {}; node = node[part]; });
  });
  const lines = [];
  if (rootName) lines.push(rootName + '/');
  (function walk(node, prefix) {
    const keys = Object.keys(node).sort();
    keys.forEach((k, i) => {
      const last = i === keys.length - 1;
      const children = node[k];
      const label = k + (Object.keys(children).length ? '/' : '');
      lines.push(prefix + (last ? '└── ' : '├── ') + label);
      if (Object.keys(children).length) walk(children, prefix + (last ? '    ' : '│   '));
    });
  })(root, '');
  return lines;
}

export { filePurpose };