import type { Attempt, Question, Topic } from "@/lib/types";
import { targetDifficulty } from "./mastery";

// Smart Study picks the next question with these rules, in order:
// 1. Resurface a question answered wrong earlier (after a few others), so mistakes get fixed.
// 2. Otherwise focus on a weak topic (weighted toward low mastery) at the right difficulty,
//    preferring questions never seen, then ones due for spaced review.
// 3. Rotate question types so the session stays varied.

export interface QuestionStats {
  seen: number;
  streak: number; // consecutive correct answers, most recent first
  lastAt: number; // ms timestamp, 0 if never
  lastCorrect: boolean;
}

export function buildStats(attempts: Attempt[]): Map<string, QuestionStats> {
  const map = new Map<string, QuestionStats>();
  const sorted = [...attempts].sort((a, b) => a.created_at.localeCompare(b.created_at));
  for (const a of sorted) {
    if (!a.question_id) continue;
    const s = map.get(a.question_id) ?? { seen: 0, streak: 0, lastAt: 0, lastCorrect: false };
    s.seen++;
    s.streak = a.correct ? s.streak + 1 : 0;
    s.lastAt = Date.parse(a.created_at);
    s.lastCorrect = a.correct;
    map.set(a.question_id, s);
  }
  return map;
}

/** Spaced-review interval: 10 min, then x4 for each correct answer in a row. */
export function reviewIntervalMs(streak: number) {
  return 10 * 60_000 * Math.pow(4, Math.max(0, streak - 1));
}

export function isDue(s: QuestionStats, now: number) {
  return s.seen > 0 && now - s.lastAt >= reviewIntervalMs(s.streak);
}

export interface PickInput {
  questions: Question[];
  topics: Topic[];
  stats: Map<string, QuestionStats>;
  recentIds: string[]; // this session, most recent last
  now: number;
  random?: () => number;
}

export function pickNextQuestion(input: PickInput): Question | null {
  const { questions, topics, stats, recentIds, now } = input;
  const random = input.random ?? Math.random;
  const pool = questions.filter((q) => q.verified && q.rating >= 0);
  if (!pool.length) return null;

  const recent = new Set(recentIds.slice(-4));
  const lastType = pool.find((q) => q.id === recentIds[recentIds.length - 1])?.type;
  const available = pool.filter((q) => !recent.has(q.id));
  const candidates = available.length ? available : pool;

  // 1. resurface recent mistakes
  const missed = candidates.filter((q) => {
    const s = stats.get(q.id);
    return s && !s.lastCorrect && now - s.lastAt < 6 * 60 * 60_000;
  });
  if (missed.length && random() < 0.6) {
    return missed.sort((a, b) => (stats.get(a.id)!.lastAt - stats.get(b.id)!.lastAt))[0];
  }

  // 2. pick a topic, weighted toward weakness
  const topicIds = new Set(candidates.map((q) => q.topic_id));
  const weighted = topics
    .filter((t) => topicIds.has(t.id))
    .map((t) => ({ t, w: Math.pow(1.15 - t.mastery, 2) }));
  let topic: Topic | undefined;
  if (weighted.length) {
    const total = weighted.reduce((s, x) => s + x.w, 0);
    let r = random() * total;
    for (const x of weighted) {
      r -= x.w;
      if (r <= 0) {
        topic = x.t;
        break;
      }
    }
    topic ??= weighted[weighted.length - 1].t;
  }
  const inTopic = topic ? candidates.filter((q) => q.topic_id === topic!.id) : candidates;
  const want = targetDifficulty(topic?.mastery ?? 0);

  const score = (q: Question) => {
    const s = stats.get(q.id);
    let v = 0;
    if (!s) v += 3; // unseen first
    else if (isDue(s, now)) v += 2;
    else v -= 2; // seen and not due yet
    v -= Math.abs(q.difficulty - want) * 0.8;
    if (q.type !== lastType) v += 0.6;
    return v + random() * 0.5;
  };

  const ranked = (inTopic.length ? inTopic : candidates).sort((a, b) => score(b) - score(a));
  return ranked[0] ?? null;
}

/** How many questions in the bank are still "fresh" (unseen or due). */
export function freshCount(questions: Question[], stats: Map<string, QuestionStats>, now: number) {
  return questions.filter((q) => {
    const s = stats.get(q.id);
    return !s || isDue(s, now);
  }).length;
}
