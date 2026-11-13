import type { Box, DiagramRegion } from "@/lib/types";

/** Gemini returns [ymin, xmin, ymax, xmax] on a 0-1000 grid. Convert to 0..1 boxes. */
export function box2dToBox(b: number[] | undefined | null): Box | null {
  if (!b || b.length !== 4 || b.some((n) => typeof n !== "number" || Number.isNaN(n))) return null;
  const [y0, x0, y1, x1] = b.map((n) => Math.min(1000, Math.max(0, n)) / 1000);
  const box = { x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) };
  if (box.w < 0.005 || box.h < 0.005) return null;
  return box;
}

export function contains(box: Box, x: number, y: number) {
  return x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h;
}

/**
 * Which region did a tap at (x, y) (0..1) land on? Overlapping regions are
 * common in anatomy diagrams, so the smallest box containing the point wins.
 * A small tolerance helps with thin structures on phones.
 */
export function hitTest(regions: DiagramRegion[], x: number, y: number, tolerance = 0.015) {
  const grow = (b: Box): Box => ({ x: b.x - tolerance, y: b.y - tolerance, w: b.w + 2 * tolerance, h: b.h + 2 * tolerance });
  const hits = regions.filter((r) => contains(grow(r.box), x, y));
  if (!hits.length) return null;
  return hits.sort((a, b) => a.box.w * a.box.h - b.box.w * b.box.h)[0];
}

export function clampBox(b: Box): Box {
  const x = Math.min(1, Math.max(0, b.x));
  const y = Math.min(1, Math.max(0, b.y));
  return { x, y, w: Math.max(0.01, Math.min(1 - x, b.w)), h: Math.max(0.01, Math.min(1 - y, b.h)) };
}

/** Loose label match for typed answers: case, punctuation and "the"/plurals ignored. */
export function labelMatches(answer: string, label: string) {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/\b(the|a|an|muscle|m\.)\b/g, " ")
      .replace(/[^a-z0-9 ]/g, " ")
      .replace(/s\b/g, "")
      .replace(/\s+/g, " ")
      .trim();
  const a = norm(answer);
  const l = norm(label);
  if (!a) return false;
  return a === l || (a.length >= 4 && (l.includes(a) || a.includes(l))) || levenshtein(a, l) <= Math.max(1, Math.floor(l.length / 6));
}

export function levenshtein(a: string, b: string) {
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}
