"use client";
import { ChevronRight, Loader2, Minus, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";
import { QUESTION_TYPE_LABEL, type QuestionType, type TestConfig } from "@/lib/types";
import { Badge, Button, Card, cx, ErrorNote } from "@/components/ui";

// rough minutes per question, used for the time estimates
const MINUTES: Record<QuestionType, number> = { mcq: 0.6, true_false: 0.3, multi_select: 0.9, short_answer: 2, matching: 1.2, ordering: 1 };
const TYPES: QuestionType[] = ["mcq", "short_answer", "true_false", "multi_select", "matching", "ordering"];

interface TestRow { id: string; title: string; status: string; score: number | null; count: number; created_at: string }

export function TestSetup({ kitId, kitTitle, bank, topics, tests }: { kitId: string; kitTitle: string; bank: Partial<Record<QuestionType, number>>; topics: { id: string; name: string }[]; tests: TestRow[] }) {
  const router = useRouter();
  const [counts, setCounts] = useState<Partial<Record<QuestionType, number>>>({
    mcq: Math.min(10, bank.mcq ?? 0),
    short_answer: Math.min(2, bank.short_answer ?? 0),
  });
  const estimate = Math.max(1, Math.round(TYPES.reduce((s, t) => s + (counts[t] ?? 0) * MINUTES[t], 0)));
  const [minutes, setMinutes] = useState<number | null>(null);
  const duration = minutes ?? Math.max(5, Math.ceil(estimate / 5) * 5);
  const [enforce, setEnforce] = useState(true);
  const [difficulty, setDifficulty] = useState<1 | 2 | 3>(2);
  const [topicIds, setTopicIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const total = TYPES.reduce((s, t) => s + (counts[t] ?? 0), 0);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const config: TestConfig = { minutes: duration, enforceTime: enforce, counts, difficulty, topicIds };
      const t = await api<{ id: string }>(`/api/kits/${kitId}/tests`, { body: config });
      router.push(`/kits/${kitId}/test/${t.id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <Card className="p-5 sm:p-6">
        <h2 className="text-center text-lg font-bold">Time</h2>
        <div className="mt-3 flex items-center justify-center gap-3">
          <button type="button" onClick={() => setMinutes(Math.max(5, duration - 5))} className="grid size-9 place-items-center rounded-full border border-border" aria-label="Less time"><Minus className="size-4" /></button>
          <div className="min-w-24 text-center text-2xl font-bold">{duration} min</div>
          <button type="button" onClick={() => setMinutes(Math.min(180, duration + 5))} className="grid size-9 place-items-center rounded-full border border-border" aria-label="More time"><Plus className="size-4" /></button>
        </div>
        <p className="text-center text-xs text-muted">est. {estimate} min</p>
        <label className="mt-2 flex items-center justify-center gap-2 text-sm">
          <input type="checkbox" checked={enforce} onChange={(e) => setEnforce(e.target.checked)} className="size-4 accent-[var(--primary)]" />
          Enforce time limit (auto-submit)
        </label>

        <h2 className="mt-6 text-center text-lg font-bold">Questions</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {TYPES.map((t) => (
            <label key={t} className={cx("rounded-xl border border-border p-3 text-center", !bank[t] && "opacity-60")}>
              <div className="text-xs font-semibold text-muted">{QUESTION_TYPE_LABEL[t]}</div>
              <input
                type="number"
                min={0}
                max={50}
                value={counts[t] ?? 0}
                onChange={(e) => setCounts((c) => ({ ...c, [t]: Math.max(0, Math.min(50, Number(e.target.value) || 0)) }))}
                className="mt-1 w-16 rounded-lg border border-border bg-surface-2 px-2 py-1 text-center font-bold"
              />
              <div className="mt-1 text-[11px] text-muted">{bank[t] ?? 0} in bank · est. {Math.round((counts[t] ?? 0) * MINUTES[t])} min</div>
            </label>
          ))}
        </div>
        <p className="mt-2 text-center text-xs text-muted">If the bank is short, new questions are written for you when the test is created.</p>

        <h2 className="mt-6 text-center text-lg font-bold">Difficulty</h2>
        <div className="mx-auto mt-2 flex max-w-sm items-center gap-3 text-sm text-muted">
          Easy
          <input type="range" min={1} max={3} step={1} value={difficulty} onChange={(e) => setDifficulty(Number(e.target.value) as 1 | 2 | 3)} className="flex-1 accent-[var(--primary)]" aria-label="Difficulty" />
          Hard
        </div>

        {topics.length > 1 && (
          <>
            <h2 className="mt-6 text-center text-lg font-bold">Topics</h2>
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              {topics.map((t) => {
                const on = topicIds.includes(t.id);
                return (
                  <button key={t.id} type="button" onClick={() => setTopicIds((ids) => (on ? ids.filter((x) => x !== t.id) : [...ids, t.id]))} className={cx("rounded-full border px-3 py-1 text-sm", on ? "border-primary bg-primary/15 text-primary" : "border-border text-muted")}>
                    {t.name}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-center text-xs text-muted">{topicIds.length ? `${topicIds.length} selected` : "All topics"}</p>
          </>
        )}

        {error && <div className="mt-4"><ErrorNote>{error}</ErrorNote></div>}
        <div className="mt-6 flex justify-center">
          <Button size="lg" onClick={create} disabled={busy || total === 0}>
            {busy && <Loader2 className="size-4 animate-spin" />} Create test ({total} questions)
          </Button>
        </div>
      </Card>

      <div>
        <h3 className="mb-2 font-bold">&ldquo;{kitTitle}&rdquo; tests</h3>
        {!tests.length ? (
          <p className="text-sm text-muted">No tests yet for this kit.</p>
        ) : (
          <div className="space-y-2">
            {tests.map((t) => (
              <Link key={t.id} href={`/kits/${kitId}/test/${t.id}`}>
                <Card className="flex items-center justify-between gap-3 p-4 hover:border-primary/60">
                  <div>
                    <div className="font-semibold">{t.title}</div>
                    <div className="text-xs text-muted">{t.count} questions · {new Date(t.created_at).toLocaleDateString()}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {t.status === "submitted" ? (
                      <Badge tone={(t.score ?? 0) >= 0.9 ? "good" : (t.score ?? 0) >= 0.6 ? "accent" : "bad"}>{Math.round((t.score ?? 0) * 100)}%</Badge>
                    ) : (
                      <Badge tone="primary">In progress</Badge>
                    )}
                    <ChevronRight className="size-4 text-muted" />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
