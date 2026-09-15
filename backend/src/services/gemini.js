import { hash } from '../utils/hash.js';

const API_KEY = process.env.GEMINI_API_KEY || '';
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
// Model names drift; a valid key is never sent unless an explicit model is
// chosen, so the endpoint carries the key as the standard query parameter.
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(API_KEY)}`;

// In-process cache keyed by a stage seed so identical inputs are never
// re-billed and repeat runs stay deterministic for the same cache lifetime.
const cache = new Map();

/**
 * Modes explain where a stage's content came from, so the UI can label it:
 * - 'llm'           fresh Gemini generation for this input
 * - 'cached-llm'    Gemini result reused from this process's cache
 * - 'deterministic' no key / API error / unparseable output → bundled agent
 */
export const MODE = { LLM: 'llm', CACHED: 'cached-llm', DETERMINISTIC: 'deterministic' };

function fail(mode = MODE.DETERMINISTIC) {
  return { ok: false, data: null, mode };
}

function parseJson(raw) {
  if (!raw) return null;
  const cleaned = String(raw)
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '');
  try { return JSON.parse(cleaned); } catch { return null; }
}

/**
 * Generic Gemini call for any stage. Returns
 *   { ok: true,  data: <parsed JSON>, mode: 'llm' | 'cached-llm' }
 *   { ok: false, data: null,          mode: 'deterministic' }
 * Callers fall back to their bundled deterministic logic when ok is false.
 */
export async function runLLMStage(seedKey, prompt) {
  if (!API_KEY) return fail();

  const seed = hash(String(seedKey ?? ''));
  if (cache.has(seed)) return { ok: true, data: cache.get(seed), mode: MODE.CACHED };

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          topP: 0.9,
          responseMimeType: 'application/json',
        },
      }),
    });
    if (!res.ok) {
      console.error(`[gemini] ${MODEL} API ${res.status}:`, await res.text().catch(() => ''));
      return fail();
    }
    const data = await res.json();
    const raw = (data?.candidates?.[0]?.content?.parts || [])
      .map(p => p.text || '')
      .join('');
    const parsed = parseJson(raw);
    if (!parsed) return fail();

    cache.set(seed, parsed);
    return { ok: true, data: parsed, mode: MODE.LLM };
  } catch (err) {
    console.error('[gemini] request failed:', err);
    return fail();
  }
}

export function clearLLMCache() {
  cache.clear();
}