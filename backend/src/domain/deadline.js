/**
 * Normalize a free-text deadline string into a structured result.
 *
 * Returns:
 *   { days: number | null, label: string, kind: 'days'|'weeks'|'months'|'vague'|'empty' }
 *
 * - days: total calendar days represented, or null if unparseable / not given.
 * - label: human-readable form used in the score breakdown line.
 * - kind:  'empty'  — no deadline entered
 *          'days'   — N days parsed
 *          'weeks'  — N weeks parsed
 *          'months' — N months parsed
 *          'vague'  — non-empty but could not be reliably converted to a duration
 */
export function parseDeadline(raw) {
  const s = String(raw || '').trim();

  if (!s) {
    return { days: null, label: 'no deadline', kind: 'empty' };
  }

  const lower = s.toLowerCase();

  // Match patterns like "3 months", "1month", "2.5 months"
  const monthMatch = lower.match(/^(\d+(?:\.\d+)?)\s*months?$/);
  if (monthMatch) {
    const n = parseFloat(monthMatch[1]);
    return { days: Math.round(n * 30), label: s, kind: 'months' };
  }

  // Match patterns like "4 weeks", "1week", "2.5 weeks"
  const weekMatch = lower.match(/^(\d+(?:\.\d+)?)\s*weeks?$/);
  if (weekMatch) {
    const n = parseFloat(weekMatch[1]);
    return { days: Math.round(n * 7), label: s, kind: 'weeks' };
  }

  // Match patterns like "6 days", "1day"
  const dayMatch = lower.match(/^(\d+(?:\.\d+)?)\s*days?$/);
  if (dayMatch) {
    const n = parseFloat(dayMatch[1]);
    return { days: Math.round(n), label: s, kind: 'days' };
  }

  // Anything else (natural language, abbreviations, bare numbers without unit, etc.)
  // is treated as vague rather than silently assigned an arbitrary value.
  return { days: null, label: s, kind: 'vague' };
}

/**
 * Convert a parsed deadline into the Time Realism feasibility score (max 15).
 *
 * Scoring rationale:
 *   ≤  7 days  →  6  Very tight; high execution risk for any scope.
 *   8–14 days  →  9  Short sprint; achievable only for a very narrow problem.
 *  15–31 days  → 12  Healthy 2–4 week sprint; good MVP runway.
 *  32–90 days  → 14  1–3 months; comfortable buffer with room for iteration.
 *   > 90 days  → 13  Long horizon; introduces scope-drift risk, slight penalty.
 *   empty      →  8  No commitment signal; same as original.
 *   vague      → 10  Non-empty but unparseable; explicit middle-ground.
 */
export function deadlineScore(parsed) {
  if (parsed.kind === 'empty')  return 8;
  if (parsed.kind === 'vague')  return 10;

  const d = parsed.days;
  if (d <= 7)  return 6;
  if (d <= 14) return 9;
  if (d <= 31) return 12;
  if (d <= 90) return 14;
  return 13;
}

/**
 * Milestone time labels that fit the deadline window instead of always using
 * weeks. For a deadline of 14 days or less milestones read as "Day 1 / Day 3 /
 * Day 5 …" spread across the window; otherwise they stay weekly.
 *
 *   milestoneSlots(null, 4)        → Week 1 .. Week 4
 *   milestoneSlots(30, 4)          → Week 1 .. Week 4   (> 14 days)
 *   milestoneSlots(5, 4)           → Day 1, Day 3, Day 4, Day 5
 *   milestoneSlots(1, 4)           → Day 1 × 4          (sprint fits one day)
 *
 * @param {number|null} days  parsed deadline days (null = unknown/vague)
 * @param {number} n          number of milestones
 * @returns {string[]} display labels, one per milestone
 */
export function milestoneSlots(days, n = 4) {
  const count = Math.max(1, Math.floor(n));
  if (days == null || days > 14) {
    return Array.from({ length: count }, (_, i) => `Week ${i + 1}`);
  }
  const marks = [];
  for (let i = 0; i < count; i++) {
    marks.push(Math.max(1, Math.round(((i + 1) * days) / count)));
  }
  return marks.map(d => `Day ${d}`);
}