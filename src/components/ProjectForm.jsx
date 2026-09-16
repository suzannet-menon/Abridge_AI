import { useState, useEffect } from 'react';
import { writeDraft } from '../utils/storage.js';

const EXAMPLE = {
  name: 'Ada',
  stack: 'python',
  customStack: '',
  github: 'octocat',
  idea: 'A CLI that turns meeting notes into action items, with a simple web dashboard.',
  deadline: '4 weeks',
  comfort: 'intermediate',
  type: 'tool',
  team: 'solo',
  audience: 'busy engineers who take a lot of meeting notes',
};

const EMPTY = {
  name: '', stack: 'typescript', customStack: '', github: '',
  idea: '', deadline: '', comfort: 'beginner', type: 'tool', team: 'solo', audience: '',
};

function debounce(fn, ms) {
  let t = null;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// Auto-save draft on every change (stable debounced fn shared across renders)
const saveDraft = debounce(writeDraft, 350);

export default function ProjectForm({ onSubmit, initialData, onBack, running, onToast }) {
  const [form, setForm] = useState({ ...EMPTY, ...(initialData || {}) });
  const [hint, setHint] = useState('');
  const [prevInitial, setPrevInitial] = useState(initialData);

  useEffect(() => { saveDraft(form); }, [form]);

  // Restore from prop when the parent restores a project, without re-running
  // the draft autosave effect below it.
  if (initialData !== prevInitial) {
    setPrevInitial(initialData);
    if (initialData) setForm({ ...EMPTY, ...initialData });
  }

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = e => {
    e.preventDefault();
    if (!form.idea.trim()) { setHint('Add a project idea first.'); return; }
    setHint('');
    onSubmit(form);
  };

  const handleKeyDown = e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); handleSubmit(e); }
  };

  const loadExample = () => {
    setForm(EXAMPLE);
    onToast('Example idea loaded — ready to run.');
  };

  return (
    <section className="view" id="view-new" aria-labelledby="new-project-title">
      <button type="button" className="back-link" onClick={onBack} id="back-btn">
        ← Back to Overview
      </button>
      <h1 id="new-project-title">New project</h1>
      <p className="view-sub">
        Tell AbridgeAI about your idea. The planning pipeline will assess feasibility,
        recommend an architecture and stack, generate a starter scaffold, and produce
        a complete build-ready implementation plan.
      </p>

      <form id="project-form" className="proj-form" onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
        <div className="form-grid">
          <div className="form-main-col">
            <div className="field">
              <label htmlFor="f-name">Project name</label>
              <input
                id="f-name" name="name" type="text" placeholder="Ada" autoComplete="off"
                value={form.name} onChange={e => set('name', e.target.value)}
              />
            </div>

            <div className="field field--textarea">
              <label htmlFor="f-idea">Project idea <span className="field-required">*</span></label>
              <textarea
                id="f-idea" name="idea" rows={8}
                placeholder="Describe your idea in detail. What problem does it solve? Who is it for? What are the key features?"
                value={form.idea} onChange={e => set('idea', e.target.value)}
              />
            </div>

            <div className="field">
              <label htmlFor="f-audience">Target audience</label>
              <input
                id="f-audience" name="audience" type="text"
                placeholder="e.g. busy engineers who take a lot of meeting notes"
                autoComplete="off"
                value={form.audience} onChange={e => set('audience', e.target.value)}
              />
            </div>
          </div>

          <div className="form-side-col">
            <div className="field">
              <label htmlFor="f-stack">Preferred stack</label>
              <select id="f-stack" name="stack" value={form.stack} onChange={e => set('stack', e.target.value)}>
                <option value="typescript">TypeScript / JavaScript</option>
                <option value="python">Python</option>
                <option value="go">Go</option>
                <option value="rust">Rust</option>
                <option value="custom">Custom / Other</option>
                <option value="unsure">Not sure yet</option>
              </select>
            </div>

            {form.stack === 'custom' && (
              <div className="field field--custom-stack">
                <label htmlFor="f-custom-stack">Custom stack</label>
                <input
                  id="f-custom-stack" name="customStack" type="text"
                  placeholder="e.g. FastAPI + React + PostgreSQL"
                  autoComplete="off"
                  value={form.customStack} onChange={e => set('customStack', e.target.value)}
                />
                <p className="field-hint">
                  List each technology, separated by <code>+</code>, <code>,</code>, or a space — e.g. <code>FastAPI + React + PostgreSQL</code>.
                  The pipeline renders each component and picks a matching starter scaffold.
                </p>
              </div>
            )}

            <div className="field">
              <label htmlFor="f-github">GitHub username</label>
              <input
                id="f-github" name="github" type="text" placeholder="octocat" autoComplete="off"
                value={form.github} onChange={e => set('github', e.target.value)}
              />
              <p className="field-hint">Public profile only. Used to personalize builder signals.</p>
            </div>

            <div className="field">
              <label htmlFor="f-comfort">Comfort level</label>
              <select id="f-comfort" name="comfort" value={form.comfort} onChange={e => set('comfort', e.target.value)}>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="f-type">Project type</label>
              <select id="f-type" name="type" value={form.type} onChange={e => set('type', e.target.value)}>
                <option value="tool">CLI / developer tool</option>
                <option value="web-app">Web app</option>
                <option value="service">API / service</option>
                <option value="data-pipeline">Data pipeline</option>
                <option value="unsure">Not sure yet</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="f-team">Team size</label>
              <select id="f-team" name="team" value={form.team} onChange={e => set('team', e.target.value)}>
                <option value="solo">Solo</option>
                <option value="pair">Pair</option>
                <option value="small-team">Small team (3–5)</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="f-deadline">Deadline</label>
              <input
                id="f-deadline" name="deadline" type="text" placeholder="e.g. 4 weeks" autoComplete="off"
                value={form.deadline} onChange={e => set('deadline', e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn--primary" id="run-btn" disabled={running}>
            {running ? 'Running…' : 'Run pipeline →'}
          </button>
          <button type="button" className="btn btn--ghost" id="example-btn" onClick={loadExample} disabled={running}>
            Load example idea
          </button>
          {hint && <span className="form-hint" id="form-hint">{hint}</span>}
        </div>
        <p className="form-note">
          AbridgeAI runs a deterministic planning pipeline on the local backend — Logic is executed
          server-side, then results are returned to this dashboard.
        </p>
      </form>
    </section>
  );
}
