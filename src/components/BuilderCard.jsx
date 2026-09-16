import OutputCard from './OutputCard.jsx';
import { downloadZip } from '../utils/zip.js';

export default function BuilderCard({ builder, onToast }) {
  if (!builder) return null;

  const handleDownload = () => {
    downloadZip(builder.files, builder.folder + '.zip');
    onToast('Starter scaffold downloaded.');
  };

  const modeBadge = builder.mode === 'llm' ? 'Gemini · live'
    : builder.mode === 'groq' ? 'Groq · live'
    : builder.mode === 'cached-llm' ? 'LLM · cached'
    : builder.mode === 'deterministic' ? 'fallback' : undefined;

  return (
    <OutputCard
      index={6}
      title="Builder Plan &amp; Starter Scaffold"
      agent="builder"
      badge={modeBadge}
      copyable={builder.text}
      body={builder.text}
      onToast={onToast}
    >
      <button type="button" className="card-download" onClick={handleDownload}>
        Download scaffold (.zip)
      </button>
    </OutputCard>
  );
}
