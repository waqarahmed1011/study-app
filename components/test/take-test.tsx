"use client";
import { CheckCircle2, CircleDashed, Clock, Loader2, RotateCcw, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PublicQuestion } from "@/lib/api";
import { api } from "@/lib/client";
import type { QuestionAnswer, TestConfig, TestResultItem } from "@/lib/types";
import { initialValue, isAnswered, QuestionView, type ResponseValue } from "@/components/questions/question-view";
import { Markdown } from "@/components/markdown";
import { Badge, Button, ButtonLink, Card, cx, ErrorNote, ProgressBar } from "@/components/ui";

type Q = PublicQuestion & { review: { answer: QuestionAnswer; explanation: string; correctAnswer: string } | null };

interface Props {
  kitId: string;
  test: { id: string; title: string; config: TestConfig; started_at: string | null; status: string; score: number | null; results: TestResultItem[] | null; responses: Record<string, unknown> | null };
  questions: Q[];
  topics: { id: string; name: string }[];
}

export function TakeTest(props: Props) {
  return props.test.status === "submitted" ? <Results {...props} /> : <Runner {...props} />;
}

function Runner({ kitId, test, questions }: Props) {
  const router = useRouter();
  const storageKey = `test-${test.id}`;
  const [values, setValues] = useState<Record<string, ResponseValue>>(() => {
    const init = Object.fromEntries(questions.map((q) => [q.id, initialValue(q)]));
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null");
      if (saved) return { ...init, ...saved };
    } catch {}
    return init;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deadline = useMemo(() => Date.parse(test.started_at ?? new Date().toISOString()) + test.config.minutes * 60_000, [test]);
  const [left, setLeft] = useState(() => deadline - Date.now());
  const submitted = useRef(false);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(values));
    } catch {}
  }, [values, storageKey]);

  const submit = useCallback(async () => {
    if (submitted.current) return;
    submitted.current = true;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/tests/${test.id}/submit`, { body: { responses: values } });
      try {
        localStorage.removeItem(storageKey);
      } catch {}
      router.refresh();
    } catch (err) {
      submitted.current = false;
      setError((err as Error).message);
      setBusy(false);
    }
  }, [test.id, values, router, storageKey]);

  useEffect(() => {
    const t = setInterval(() => setLeft(deadline - Date.now()), 1000);
    return () => clearInterval(t);
  }, [deadline]);

  useEffect(() => {
    if (left <= 0 && test.config.enforceTime) submit();
  }, [left, test.config.enforceTime, submit]);

  const answered = questions.filter((q) => isAnswered(q, values[q.id])).length;
  const mm = Math.max(0, Math.floor(left / 60000));
  const ss = Math.max(0, Math.floor((left % 60000) / 1000));

  return (
    <div className="mx-auto max-w-3xl">
      <div className="sticky top-14 z-20 -mx-4 mb-4 border-b border-border bg-bg/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{test.title}</div>
            <div className="text-xs text-muted">{answered}/{questions.length} answered</div>
          </div>
          <div className={cx("flex items-center gap-1.5 font-mono text-lg font-bold", left < 60_000 && "text-bad")}>
            <Clock className="size-4" /> {left > 0 ? `${mm}:${String(ss).padStart(2, "0")}` : "Time's up"}
          </div>
        </div>
        <ProgressBar value={answered / Math.max(1, questions.length)} className="mt-2 h-1.5" />
      </div>

      <ol className="space-y-5">
        {questions.map((q, i) => (
          <li key={q.id}>
            <Card className="p-5">
              <div className="mb-2 text-xs font-semibold text-muted">Question {i + 1}</div>
              <QuestionView q={q} value={values[q.id]} onChange={(v) => setValues((s) => ({ ...s, [q.id]: v }))} disabled={busy} compact />
            </Card>
          </li>
        ))}
      </ol>

      {error && <div className="mt-4"><ErrorNote>{error}</ErrorNote></div>}
      <div className="mt-6 flex justify-center">
        <Button
          size="lg"
          disabled={busy}
          onClick={() => {
            if (answered < questions.length && !confirm(`${questions.length - answered} question(s) unanswered. Submit anyway?`)) return;
            submit();
          }}
        >
          {busy && <Loader2 className="size-4 animate-spin" />} {busy ? "Grading…" : "Submit test"}
        </Button>
      </div>
      <p className="mt-3 text-center text-xs text-muted">
        Your answers are saved on this device if you leave. <Link href={`/kits/${kitId}/test`} className="underline">Back to tests</Link>
      </p>
    </div>
  );
}

function Results({ kitId, test, questions, topics }: Props) {
  const results = new Map((test.results ?? []).map((r) => [r.question_id, r]));
  const names = new Map(topics.map((t) => [t.id, t.name]));
  const byTopic = new Map<string, { score: number; n: number }>();
  for (const q of questions) {
    const key = q.topic_id ?? "other";
    const r = results.get(q.id);
    const cur = byTopic.get(key) ?? { score: 0, n: 0 };
    byTopic.set(key, { score: cur.score + (r?.score ?? 0), n: cur.n + 1 });
  }
  const pct = Math.round((test.score ?? 0) * 100);

  return (
    <div className="mx-auto max-w-3xl">
      <Card className="mb-6 p-6 text-center">
        <div className="text-sm text-muted">{test.title}</div>
        <div className={cx("mt-1 text-5xl font-extrabold", pct >= 90 ? "text-good" : pct >= 60 ? "text-accent" : "text-bad")}>{pct}%</div>
        <p className="mt-1 text-sm text-muted">
          {questions.filter((q) => results.get(q.id)?.correct).length} of {questions.length} fully correct
        </p>
        <div className="mt-5 space-y-2 text-left">
          {[...byTopic.entries()].map(([tid, v]) => (
            <div key={tid}>
              <div className="flex justify-between text-sm">
                <span>{names.get(tid) ?? "Other"}</span>
                <span className="text-muted">{Math.round((v.score / v.n) * 100)}%</span>
              </div>
              <ProgressBar value={v.score / v.n} tone={v.score / v.n >= 0.8 ? "good" : "accent"} className="mt-1 h-1.5" />
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <ButtonLink href={`/kits/${kitId}/test`} variant="secondary">
            <RotateCcw className="size-4" /> New test
          </ButtonLink>
          <ButtonLink href={`/kits/${kitId}/smart`}>Practise weak spots</ButtonLink>
        </div>
      </Card>

      <h3 className="mb-3 font-bold">Review</h3>
      <ol className="space-y-4">
        {questions.map((q, i) => {
          const r = results.get(q.id);
          const v = (test.responses?.[q.id] as ResponseValue) ?? initialValue(q);
          return (
            <li key={q.id}>
              <Card className="p-5">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted">
                  {r?.correct ? <CheckCircle2 className="size-4 text-good" /> : (r?.score ?? 0) > 0 ? <CircleDashed className="size-4 text-accent" /> : <XCircle className="size-4 text-bad" />}
                  Question {i + 1}
                  {q.topic_id && names.get(q.topic_id) && <Badge>{names.get(q.topic_id)}</Badge>}
                </div>
                <QuestionView q={q} value={v} onChange={() => {}} reveal={q.review ? { answer: q.review.answer } : null} compact />
                {r?.feedback && <p className="mt-3 text-sm"><span className="font-semibold">Feedback: </span>{r.feedback}</p>}
                {q.review && (q.type === "short_answer" || !r?.correct) && (
                  <p className="mt-2 text-sm"><span className="font-semibold">Answer: </span>{q.review.correctAnswer}</p>
                )}
                {q.review?.explanation && <Markdown className="mt-2 text-sm text-muted">{q.review.explanation}</Markdown>}
              </Card>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
