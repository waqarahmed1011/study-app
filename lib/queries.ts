import "server-only";
import type { Repo } from "@/lib/data/repo";
import { averageMastery, levelFromMastery } from "@/lib/study/mastery";
import { isCardDue } from "@/lib/study/fsrs";
import { streakFrom } from "@/lib/study/service";

/** Everything the dashboard needs in one pass. */
export async function dashboardData(repo: Repo) {
  const [kits, topics, cards, attempts, questions] = await Promise.all([
    repo.list("kits", {}, { orderBy: "updated_at", ascending: false }),
    repo.list("topics"),
    repo.list("flashcards"),
    repo.list("attempts", {}, { orderBy: "created_at", ascending: false }),
    repo.list("questions"),
  ]);
  const now = new Date();
  const today = now.toLocaleDateString("en-CA");
  const lastStudied = new Map<string, string>();
  for (const a of attempts) if (!lastStudied.has(a.kit_id)) lastStudied.set(a.kit_id, a.created_at);

  const kitStats = kits.map((k) => {
    const ts = topics.filter((t) => t.kit_id === k.id);
    const mastery = averageMastery(ts);
    return {
      kit: k,
      mastery,
      level: levelFromMastery(mastery),
      due: cards.filter((c) => c.kit_id === k.id && isCardDue(c, now)).length,
      questions: questions.filter((q) => q.kit_id === k.id).length,
      lastStudied: lastStudied.get(k.id) ?? null,
    };
  });
  const continueKit = [...kitStats].filter((s) => s.lastStudied).sort((a, b) => b.lastStudied!.localeCompare(a.lastStudied!))[0] ?? null;

  return {
    kitStats,
    continueKit,
    streak: streakFrom(attempts.map((a) => a.created_at), now),
    answeredToday: attempts.filter((a) => new Date(a.created_at).toLocaleDateString("en-CA") === today).length,
    dueTotal: kitStats.reduce((s, k) => s + k.due, 0),
  };
}
