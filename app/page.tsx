import Link from "next/link";
import { Flame, Layers, Plus, Sparkles, Target } from "lucide-react";
import { getRepo } from "@/lib/data";
import { dashboardData } from "@/lib/queries";
import { ButtonLink, Card, EmptyState, ProgressBar } from "@/components/ui";
import { DailyGoal } from "@/components/daily-goal";


function ago(iso: string | null) {
  if (!iso) return "Not studied yet";
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (m < 60) return `Studied ${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `Studied ${h}h ago`;
  return `Studied ${Math.round(h / 24)}d ago`;
}

export default async function Home() {
  const repo = await getRepo();
  const d = await dashboardData(repo);

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 pb-24">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Your study kits</h1>
          <p className="mt-1 text-muted">Upload notes, PDFs, photos or diagrams and study them actively.</p>
        </div>
        <ButtonLink href="/kits/new" size="lg">
          <Plus className="size-5" /> New kit
        </ButtonLink>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm text-muted"><Flame className="size-4 text-accent" /> Streak</div>
          <div className="mt-1 text-2xl font-bold">{d.streak} <span className="text-base font-medium text-muted">day{d.streak === 1 ? "" : "s"}</span></div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm text-muted"><Target className="size-4 text-primary" /> Today</div>
          <DailyGoal answered={d.answeredToday} />
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm text-muted"><Layers className="size-4 text-primary" /> Cards due</div>
          <div className="mt-1 text-2xl font-bold">{d.dueTotal}</div>
        </Card>
      </div>

      {d.continueKit && (
        <Card className="mb-6 flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex items-center gap-4">
            <div className="grid size-12 place-items-center rounded-2xl bg-surface-2 text-2xl">{d.continueKit.kit.emoji}</div>
            <div>
              <div className="text-sm text-muted">Pick up where you left off</div>
              <div className="text-lg font-semibold">{d.continueKit.kit.title}</div>
            </div>
          </div>
          <ButtonLink href={`/kits/${d.continueKit.kit.id}/smart`}>
            <Sparkles className="size-4" /> Continue Smart Study
          </ButtonLink>
        </Card>
      )}

      {d.kitStats.length === 0 ? (
        <EmptyState icon={<Sparkles className="size-8" />} title="Make your first study kit">
          Add lecture slides, a PDF chapter, photos of your notes or an anatomy diagram. You&apos;ll get flashcards, practice questions,
          a study guide and an adaptive Smart Study session.
          <div className="mt-4">
            <ButtonLink href="/kits/new">
              <Plus className="size-4" /> New kit
            </ButtonLink>
          </div>
        </EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {d.kitStats.map((s) => (
            <Link key={s.kit.id} href={`/kits/${s.kit.id}/smart`} className="group">
              <Card className="h-full p-5 transition group-hover:border-primary/60">
                <div className="flex items-start gap-3">
                  <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-surface-2 text-xl">{s.kit.emoji}</div>
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{s.kit.title}</div>
                    <div className="text-xs text-muted">{s.kit.status === "ready" ? ago(s.lastStudied) : s.kit.status === "error" ? "Needs attention" : "Building…"}</div>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between text-xs text-muted">
                  <span>Level {s.level.level}</span>
                  <span>{s.questions} questions · {s.due} cards due</span>
                </div>
                <ProgressBar className="mt-2" value={s.level.pct / 100} />
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
