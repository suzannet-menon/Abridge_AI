import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPipeline } from './src/pipeline/runPipeline.js';
import { stageMeta } from './src/pipeline/stages.js';
import { STACKS } from './src/domain/stacks.js';
import { PROJECT_TYPES, TEAM_SIZES } from './src/domain/types.js';
import { buildBriefMarkdown } from './src/export/markdown.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, '../dist');

/**
 * Builds the full Express app (API + production static serving).
 *
 * Exportable (not listening) so it can run as:
 *  - a long-lived local server  → node backend/server.js
 *  - a Vercel serverless function → api/index.js (imports this)
 */
export function createApp() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // ── API ───────────────────────────────────────────────────────────────────
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'abridgeai-backend' });
  });

  // Stage/domain metadata → drives the timeline, landing preview, and form
  // dropdowns so stage names/order never drift across the UI (single source).
  app.get('/api/meta', (_req, res) => {
    res.json({
      stages: stageMeta(),
      stacks: Object.entries(STACKS).map(([key, s]) => ({ key, label: s.label })),
      projectTypes: Object.entries(PROJECT_TYPES).map(([key, value]) => ({ key, label: value })),
      teamSizes: Object.entries(TEAM_SIZES).map(([key, value]) => ({ key, label: value })),
    });
  });

  app.post('/api/plan', async (req, res) => {
    try {
      const input = req.body || {};
      const { results, errors } = await runPipeline(input);
      if (Object.keys(errors).length) console.warn('[api/plan] stage errors:', errors);
      res.json({ ok: true, results, errors });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: 'Pipeline failed. Please try again.' });
    }
  });

  app.post('/api/export', (req, res) => {
    try {
      const record = req.body;
      if (!record) {
        return res.status(400).json({ ok: false, error: 'Missing record.' });
      }
      const { filename, markdown } = buildBriefMarkdown(record);
      res.json({ ok: true, filename, markdown });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: 'Export failed. Please try again.' });
    }
  });

  // ── Serve the built frontend (production / single-port mode) ─────────────
  app.use(express.static(DIST));

  app.get(/^\/(?!api\/).*/, (req, res) => {
    res.sendFile(path.join(DIST, 'index.html'));
  });

  return app;
}