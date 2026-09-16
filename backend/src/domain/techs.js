// Recognized technologies for custom-stack input. `parseCustomStack` turns a
// free-text combination ("FastAPI + React + PostgreSQL") into structured
// components so the pipeline can reason about it instead of showing one blob.

const TECH_MAP = {
  typescript:     { label: 'TypeScript',        category: 'runtime' },
  javascript:     { label: 'JavaScript',        category: 'runtime' },
  node:           { label: 'Node.js',           category: 'runtime' },
  nodejs:         { label: 'Node.js',           category: 'runtime' },
  bun:            { label: 'Bun',               category: 'runtime' },
  deno:           { label: 'Deno',              category: 'runtime' },
  python:         { label: 'Python',            category: 'runtime' },
  go:             { label: 'Go',                category: 'runtime' },
  golang:         { label: 'Go',                category: 'runtime' },
  rust:           { label: 'Rust',              category: 'runtime' },
  java:           { label: 'Java',              category: 'runtime' },
  c:              { label: 'C',                 category: 'runtime' },
  cpp:            { label: 'C++',               category: 'runtime' },
  cxx:            { label: 'C++',               category: 'runtime' },
  csharp:         { label: 'C# / .NET',         category: 'runtime' },
  dotnet:         { label: 'C# / .NET',         category: 'runtime' },
  ruby:           { label: 'Ruby',              category: 'runtime' },
  php:            { label: 'PHP',               category: 'runtime' },

  react:          { label: 'React',             category: 'ui' },
  reactjs:        { label: 'React',             category: 'ui' },
  vue:            { label: 'Vue',               category: 'ui' },
  vuejs:          { label: 'Vue',               category: 'ui' },
  svelte:         { label: 'Svelte',            category: 'ui' },
  solid:          { label: 'SolidJS',           category: 'ui' },
  angular:        { label: 'Angular',           category: 'ui' },
  next:           { label: 'Next.js',           category: 'ui' },
  nextjs:         { label: 'Next.js',           category: 'ui' },
  nuxt:           { label: 'Nuxt',              category: 'ui' },
  remix:          { label: 'Remix',             category: 'ui' },
  vite:           { label: 'Vite',              category: 'ui' },
  tailwind:       { label: 'Tailwind',          category: 'ui' },
  tailwindcss:    { label: 'Tailwind',          category: 'ui' },
  bootstrap:      { label: 'Bootstrap',         category: 'ui' },
  shadcn:         { label: 'shadcn/ui',         category: 'ui' },
  astro:          { label: 'Astro',             category: 'ui' },
  html:           { label: 'HTML',              category: 'ui' },

  express:        { label: 'Express',           category: 'api' },
  fastify:        { label: 'Fastify',           category: 'api' },
  hono:           { label: 'Hono',              category: 'api' },
  fastapi:        { label: 'FastAPI',           category: 'api' },
  flask:          { label: 'Flask',             category: 'api' },
  django:         { label: 'Django',            category: 'api' },
  nest:           { label: 'NestJS',            category: 'api' },
  nestjs:         { label: 'NestJS',            category: 'api' },
  gin:            { label: 'Gin',               category: 'api' },
  echo:           { label: 'Echo',              category: 'api' },
  axum:           { label: 'Axum',              category: 'api' },
  actix:          { label: 'Actix',             category: 'api' },
  spring:         { label: 'Spring',            category: 'api' },
  graphql:        { label: 'GraphQL',           category: 'api' },
  trpc:           { label: 'tRPC',              category: 'api' },

  postgres:       { label: 'PostgreSQL',        category: 'data' },
  postgresql:     { label: 'PostgreSQL',        category: 'data' },
  sqlite:         { label: 'SQLite',            category: 'data' },
  mysql:          { label: 'MySQL',             category: 'data' },
  mariadb:        { label: 'MariaDB',           category: 'data' },
  mongo:          { label: 'MongoDB',           category: 'data' },
  mongodb:        { label: 'MongoDB',           category: 'data' },
  redis:          { label: 'Redis',             category: 'data' },
  prisma:         { label: 'Prisma',            category: 'data' },
  drizzle:        { label: 'Drizzle',           category: 'data' },
  supabase:       { label: 'Supabase',          category: 'data' },
  firebase:       { label: 'Firebase',          category: 'data' },
  dynamodb:       { label: 'DynamoDB',          category: 'data' },
  typeorm:        { label: 'TypeORM',           category: 'data' },
  sqlalchemy:     { label: 'SQLAlchemy',        category: 'data' },

  vitest:         { label: 'Vitest',            category: 'test' },
  jest:           { label: 'Jest',              category: 'test' },
  pytest:         { label: 'pytest',            category: 'test' },
  mocha:          { label: 'Mocha',             category: 'test' },
  rspec:          { label: 'RSpec',             category: 'test' },

  docker:         { label: 'Docker',            category: 'infra' },
  kubernetes:     { label: 'Kubernetes',        category: 'infra' },
  k8s:            { label: 'Kubernetes',        category: 'infra' },
  terraform:      { label: 'Terraform',         category: 'infra' },
  nginx:          { label: 'Nginx',             category: 'infra' },
  vercel:         { label: 'Vercel',            category: 'infra' },
  netlify:        { label: 'Netlify',           category: 'infra' },
};

export const CATEGORY_LABELS = {
  runtime: 'Runtime / app',
  ui: 'UI',
  api: 'API / backend',
  data: 'Data',
  test: 'Tests',
  infra: 'Infra / deploy',
};

export function parseCustomStack(str) {
  let text = String(str || '').trim();
  if (!text) return { components: [], unknown: [] };

  // "C++" and "C#" contain +/# which are stack separators — normalize them
  // before splitting so they stay a single recognized token.
  text = text.replace(/c\+\+/gi, ' cpp ').replace(/c#/gi, ' csharp ');

  const tokens = text.split(/[\s,+/|;]+/).map(t => t.trim().toLowerCase()).filter(Boolean);
  const components = [];
  const unknown = [];

  tokens.forEach(token => {
    const hit = TECH_MAP[token];
    if (hit) components.push({ token, label: hit.label, category: hit.category });
    else if (!/[+*|,;]/.test(token)) unknown.push(token);
  });

  return { components, unknown };
}

// Pick which bundled starter scaffold language to emit for a custom stack.
export function starterLanguageFor(input) {
  if (input.customStack) {
    const { components } = parseCustomStack(input.customStack);
    const tokens = components.map(c => c.token);
    if (tokens.includes('python') || tokens.some(t => ['fastapi', 'flask', 'django'].includes(t))) return 'python';
    if (tokens.includes('go') || tokens.includes('golang') || tokens.some(t => ['gin', 'echo'].includes(t))) return 'go';
    if (tokens.includes('rust') || tokens.some(t => ['axum', 'actix'].includes(t))) return 'rust';
    return 'typescript'; // Node/JS/anything else → TypeScript starter
  }
  return input.stack;
}