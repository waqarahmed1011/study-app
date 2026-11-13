import Link from "next/link";
import { getRepo } from "@/lib/data";
import { averageMastery, levelFromMastery } from "@/lib/study/mastery";
import { streakFrom } from "@/lib/study/service";
import { Card, EmptyState, PageTitle, ProgressBar } from "@/components/ui";

export const metadata = { title: "Progress" };

export default async function ProgressPage() {
  const repo = await getRepo();
  const [kits, topics, attempts] = await Promise.all([
    repo.list("kits", {}, { orderBy: "updated_at", ascending: false }),
    repo.list("topics"),
    repo.list("attempts", {}, { orderBy: "created_at" }),
  ]);

  // last 14 days of activity
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    return d.toLocaleDateString("en-CA");
  });
  const perDay = new Map(days.map((d) => [d, { n: 0, right: 0 }]));
  for (const a of attempts) {
    const k = new Date(a.created_at).toLocaleDateString("en-CA");
    const v = perDay.get(k);
    if (v) {
      v.n++;
      v.right += a.score;
    }
  }
  const max = Math.max(1, ...[...perDay.values()].map((v) => v.n));
  const total = attempts.length;
  const accuracy = total ? attempts.reduce((s, a) => s + a.score, 0) / total : 0;

  if (!kits.length) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-6">
        <PageTitle>Progress</PageTitle>
        <EmptyState title="Nothing to show yet">Create a study kit and answer a few questions.</EmptyState>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 pb-24">
      <PageTitle sub="What you've mastered, what's improving, and what needs another pass.">Progress</PageTitle>

      <div className="mb-6 grid grid-cols-3 gap-3">
        <Card className="p-4"><div className="text-sm text-muted">Answers</div><div className="mt-1 text-2xl font-bold">{total}</div></Card>
        <Card className="p-4"><div className="text-sm text-muted">Accuracy</div><div className="mt-1 text-2xl font-bold">{Math.round(accuracy * 100)}%</div></Card>
        <Card className="p-4"><div className="text-sm text-muted">Streak</div><div className="mt-1 text-2xl font-bold">{streakFrom(attempts.map((a) => a.created_at))}d</div></Card>
      </div>

      <Card className="mb-6 p-5">
        <h2 className="mb-4 font-bold">Last 14 days</h2>
        <div className="flex h-36 items-end gap-1.5" role="img" aria-label="Answers per day over the last 14 days">
          {days.map((d) => {
            const v = perDay.get(d)!;
            return (
              <div key={d} className="group relative flex flex-1 flex-col items-center justify-end gap-1">
                <div className="flex w-full flex-col justify-end overflow-hidden rounded-t-md bg-surface-2" style={{ height: `${(v.n / max) * 100}%`, minHeight: v.n ? 4 : 0 }}>
                  <div className="w-full bg-primary" style={{ height: `${v.n ? (v.right / v.n) * 100 : 0}%` }} />
                </div>
                <span className="text-[10px] text-muted">{new Date(d + "T12:00").toLocaleDateString(undefined, { weekday: "narrow" })}</span>
                <span className="pointer-events-none absolute -top-6 hidden rounded bg-surface-2 px-1.5 py-0.5 text-[10px] group-hover:block">{v.n} answers</span>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-muted">Bar height = answers. Filled part = share correct.</p>
      </Card>

      <div className="space-y-4">
        {kits.map((k) => {
          const ts = topics.filter((t) => t.kit_id === k.id).sort((a, b) => a.mastery - b.mastery);
          const avg = averageMastery(ts);
          const lvl = levelFromMastery(avg);
          return (
            <Card key={k.id} className="p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <Link href={`/kits/${k.id}/smart`} className="flex items-center gap-2 font-bold hover:text-primary">
                  <span className="text-xl">{k.emoji}</span> {k.title}
                </Link>
                <span className="text-sm text-muted">Level {lvl.level} · {Math.round(avg * 100)}%</span>
              </div>
              <div className="space-y-2.5">
                {ts.map((t) => (
                  <div key={t.id}>
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="truncate">{t.name}</span>
                      <span className="shrink-0 text-muted">
                        {t.mastery >= 0.8 ? "Mastered" : t.mastery >= 0.5 ? "Improving" : t.attempts ? "Needs work" : "Not started"} · {t.correct}/{t.attempts}
                      </span>
                    </div>
                    <ProgressBar value={t.mastery} className="mt-1 h-1.5" tone={t.mastery >= 0.8 ? "good" : t.mastery >= 0.5 ? "primary" : "accent"} />
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
    </main>
  );
}
