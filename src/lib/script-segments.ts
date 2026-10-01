import type { ScriptSegment } from "@/lib/types";

/**
 * Fallback caption timing for manually edited or duration-adjusted scripts.
 * AI-generated scripts keep their richer scene mapping; this helper ensures
 * edited speech never reuses stale timings from an older text version.
 */
export function segmentsFromText(text: string, durationSeconds: number): ScriptSegment[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const pieces = (clean.match(/[^.!?…]+[.!?…]?/g) || [clean])
    .map((part) => part.trim())
    .filter(Boolean);
  const totalWeight = pieces.reduce((sum, part) => sum + Math.max(1, part.length), 0);
  let cursor = 0;
  return pieces.map((part, index) => {
    const remaining = Math.max(0, durationSeconds - cursor);
    const share = index === pieces.length - 1
      ? remaining
      : durationSeconds * (Math.max(1, part.length) / totalWeight);
    const start = Number(cursor.toFixed(3));
    cursor = Math.min(durationSeconds, cursor + share);
    const end = Number(cursor.toFixed(3));
    return {
      start,
      end: Math.max(start + 0.2, end),
      scene_id: `auto-${index + 1}`,
      voice_text: part,
      caption: part
    };
  }).map((segment, index, all) => ({
    ...segment,
    end: index === all.length - 1 ? durationSeconds : Math.min(durationSeconds, segment.end)
  }));
}
