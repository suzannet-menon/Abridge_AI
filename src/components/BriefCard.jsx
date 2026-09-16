import OutputCard from './OutputCard.jsx';

export default function BriefCard({ brief, briefText, onToast }) {
  // Accept either the new structured object (brief) or the legacy string prop (briefText).
  // briefText kept for any call sites that haven't been updated yet.
  const resolved = brief ?? briefText;
  if (!resolved) return null;

  // Structured object from briefAgent; legacy history records pass a plain string.
  const text = (typeof resolved === 'object' && resolved !== null)
    ? resolved.text
    : resolved;

  const modeBadge = (typeof resolved === 'object' && resolved !== null && resolved.mode === 'llm') ? 'Gemini · live'
    : (typeof resolved === 'object' && resolved !== null && resolved.mode === 'groq') ? 'Groq · live'
    : (typeof resolved === 'object' && resolved !== null && resolved.mode === 'cached-llm') ? 'LLM · cached'
    : (typeof resolved === 'object' && resolved !== null && resolved.mode === 'deterministic') ? 'fallback'
    : undefined;

  return (
    <OutputCard
      index={7}
      title="Implementation Plan"
      agent="brief"
      badge={modeBadge}
      copyable={text}
      onToast={onToast}
    >
      <div className="prompt-wrap">
        <textarea
          id="impl-plan"
          readOnly
          value={text}
          aria-label="Implementation plan text"
        />
      </div>
    </OutputCard>
  );
}
