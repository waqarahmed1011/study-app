// Topic mastery: a number in 0..1 updated after each answer.
// Like an Elo rating against the question's difficulty: beating a hard question
// moves you up more than an easy one; missing an easy one costs more.

const DIFFICULTY_LEVEL: Record<1 | 2 | 3, number> = { 1: 0.3, 2: 0.55, 3: 0.8 };

export function expectedScore(mastery: number, difficulty: 1 | 2 | 3) {
  // logistic curve on the gap between skill and question difficulty
  const gap = mastery - DIFFICULTY_LEVEL[difficulty];
  return 1 / (1 + Math.exp(-6 * gap));
}

export function updateMastery(
  mastery: number,
  difficulty: 1 | 2 | 3,
  score: number,
  attempts: number,
) {
  // bigger steps early on so new topics settle quickly
  const k = attempts < 5 ? 0.25 : attempts < 20 ? 0.15 : 0.1;
  const next = mastery + k * (score - expectedScore(mastery, difficulty));
  return Math.min(1, Math.max(0, next));
}

/** Target difficulty for the next question on a topic. */
export function targetDifficulty(mastery: number): 1 | 2 | 3 {
  if (mastery < 0.35) return 1;
  if (mastery < 0.7) return 2;
  return 3;
}

/** Kit level shown in the Smart Study bar: 10 levels across 0..1 mastery. */
export function levelFromMastery(avg: number) {
  const scaled = Math.min(0.9999, Math.max(0, avg)) * 10;
  const level = Math.floor(scaled) + 1;
  const pct = Math.round((scaled - Math.floor(scaled)) * 100);
  return { level, pct };
}

export function averageMastery(topics: { mastery: number }[]) {
  if (!topics.length) return 0;
  return topics.reduce((s, t) => s + t.mastery, 0) / topics.length;
}
