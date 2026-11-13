"use client";
import { Lightbulb, Loader2, Settings2, Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicQuestion } from "@/lib/api";
import { api } from "@/lib/client";
import type { AnswerResult } from "@/lib/study/service";
import { QUESTION_TYPE_LABEL } from "@/lib/types";
import { initialValue, isAnswered, QuestionView, type ResponseValue } from "@/components/questions/question-view";
import { Markdown } from "@/components/markdown";
import { Badge, Button, Card, cx, EmptyState, ErrorNote, ProgressBar } from "@/components/ui";

interface NextRes {
  question: PublicQuestion | null;
  topic: { id: string; name: string; mastery: number } | null;
  seenBefore: boolean;
  level: { level: number; pct: number };
  toppedUp: boolean;
}

export function SmartStudy({ kitId, topics }: { kitId: string; topics: { id: string; name: string }[] }) {
  const [sessionId] = useState(() => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now())));
  const [data, setData] = useState<NextRes | null>(null);
  const [value, setValue] = useState<ResponseValue>(null);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [busy, setBusy] = useState<"next" | "answer" | "hint" | null>("next");
  const [error, setError] = useState<string | null>(null);
  const [focusTopic, setFocusTopic] = useState<string>("");
  const [showSettings, setShowSettings] = useState(false);
  const [session, setSession] = useState({ answered: 0, correct: 0, streak: 0 });
  const [rated, setRated] = useState(0);
  const recent = useRef<string[]>([]);

  const loadNext = useCallback(async () => {
    setBusy("next");
    setError(null);
    setResult(null);
    setHint(null);
    setRated(0);
    try {
      const res = await api<NextRes>(`/api/kits/${kitId}/smart`, { body: { recentIds: recent.current, topicId: focusTopic || undefined } });
      setData(res);
      if (res.question) {
        setValue(initialValue(res.question));
        recent.current = [...recent.current, res.question.id].slice(-10);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }, [kitId, focusTopic]);

  // fetching the first question on mount (and when the topic filter changes) is intended
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadNext();
  }, [loadNext]);

  async function submit(v: ResponseValue) {
    if (!data?.question || result || busy) return;
    setBusy("answer");
    setError(null);
    try {
      const res = await api<AnswerResult>(`/api/questions/${data.question.id}/answer`, { body: { response: v, sessionId, mode: "smart" } });
      setResult(res);
      setData((d) => (d ? { ...d, level: res.level } : d));
      setSession((s) => ({ answered: s.answered + 1, correct: s.correct + (res.correct ? 1 : 0), streak: res.correct ? s.streak + 1 : 0 }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function getHint() {
    if (!data?.question) return;
    setBusy("hint");
    try {
      const res = await api<{ hint: string }>(`/api/questions/${data.question.id}/hint`, { body: {} });
      setHint(res.hint);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function rate(r: 1 | -1) {
    if (!data?.question) return;
    setRated(r);
    await api(`/api/questions/${data.question.id}`, { method: "PATCH", body: { rating: r } }).catch(() => {});
  }

  // Enter = check / next
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.shiftKey || (e.target as HTMLElement)?.tagName === "TEXTAREA") return;
      if (result) loadNext();
      else if (data?.question && isAnswered(data.question, value)) submit(value);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const q = data?.question;
  const instantPick = q && (q.type === "mcq" || q.type === "true_false");
  const stars = Math.min(3, Math.floor(session.streak / 3));

  return (
    <div className="mx-auto max-w-3xl">
      {/* level bar, like a game HUD */}
      <div className="mb-5 flex items-center gap-3">
        <Badge tone="primary" className="shrink-0">Level {data?.level.level ?? 1}</Badge>
        <ProgressBar value={(data?.level.pct ?? 0) / 100} className="flex-1" />
        <span className="flex shrink-0 gap-0.5" aria-label={`${stars} of 3 streak stars`}>
          {[0, 1, 2].map((i) => (
            <Sparkles key={i} className={cx("size-4", i < stars ? "text-accent" : "text-border")} />
          ))}
        </span>
        <button type="button" onClick={() => setShowSettings((s) => !s)} className="grid size-9 place-items-center rounded-full text-muted hover:bg-surface-2" aria-label="Session settings" aria-expanded={showSettings}>
          <Settings2 className="size-5" />
        </button>
      </div>

      {showSettings && (
        <Card className="mb-5 p-4 animate-pop">
          <label className="text-sm font-semibold" htmlFor="focus">Focus on a topic</label>
          <select id="focus" value={focusTopic} onChange={(e) => setFocusTopic(e.target.value)} className="mt-2 w-full rounded-xl border border-border bg-surface-2 px-3 py-2">
            <option value="">All topics (adaptive)</option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <p className="mt-3 text-xs text-muted">
            This session: {session.answered} answered, {session.correct} correct. Keys: 1–4 to answer, Enter for next.
          </p>
        </Card>
      )}

      {error && <div className="mb-4"><ErrorNote>{error}</ErrorNote></div>}

      {busy === "next" && !q ? (
        <div className="grid place-items-center py-20 text-muted"><Loader2 className="size-6 animate-spin" /></div>
      ) : !q ? (
        <EmptyState icon={<Sparkles className="size-8" />} title="No questions available">
          {focusTopic ? "This topic has no questions yet. Pick all topics in settings." : "Add more material in Materials to generate questions."}
        </EmptyState>
      ) : (
        <div className={cx("transition-opacity", busy === "next" && "opacity-50")}>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
            {data?.topic && <Badge>{data.topic.name}</Badge>}
            <Badge>{QUESTION_TYPE_LABEL[q.type]}</Badge>
            {data?.seenBefore && <Badge tone="accent">Review</Badge>}
            {data?.toppedUp && <Badge tone="primary">New questions added</Badge>}
            {q.origin === "diagram" && <Badge tone="accent">Diagram</Badge>}
          </div>

          <QuestionView q={q} value={value} onChange={setValue} onPick={instantPick ? submit : undefined} reveal={result ? { answer: result.answer } : null} disabled={busy === "answer"} />

          {hint && !result && (
            <div className="mt-4 flex gap-2 rounded-xl border border-accent/40 bg-accent/10 p-3 text-sm">
              <Lightbulb className="size-4 shrink-0 text-accent" /> {hint}
            </div>
          )}

          {result && (
            <div className={cx("mt-5 rounded-2xl border-2 p-4 animate-pop", result.correct ? "border-good bg-good-soft" : result.score > 0 ? "border-accent bg-accent/10" : "border-bad bg-bad-soft")} aria-live="polite">
              <div className="font-bold">{result.correct ? "Correct!" : result.score > 0 ? "Partly right" : "Not quite"}</div>
              {result.feedback && <p className="mt-1 text-sm">{result.feedback}</p>}
              {!result.correct && (q.type === "short_answer" || q.type === "multi_select") && (
                <p className="mt-2 text-sm"><span className="font-semibold">Answer: </span>{result.correctAnswer}</p>
              )}
              {result.explanation && <Markdown className="mt-2 text-sm">{result.explanation}</Markdown>}
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <Link href={`/kits/${kitId}/history`} className="rounded-full border border-border px-3 py-1.5 text-sm font-semibold text-muted hover:text-text">
              Question history
            </Link>
            <div className="flex items-center gap-2">
              {!result && (
                <Button variant="ghost" size="sm" onClick={getHint} disabled={busy !== null}>
                  {busy === "hint" ? <Loader2 className="size-4 animate-spin" /> : <Lightbulb className="size-4" />} Hint
                </Button>
              )}
              <button type="button" onClick={() => rate(1)} className={cx("grid size-9 place-items-center rounded-full", rated === 1 ? "bg-good text-white" : "bg-good-soft text-good")} aria-label="Good question" aria-pressed={rated === 1}>
                <ThumbsUp className="size-4" />
              </button>
              <button type="button" onClick={() => rate(-1)} className={cx("grid size-9 place-items-center rounded-full", rated === -1 ? "bg-bad text-white" : "bg-bad-soft text-bad")} aria-label="Bad question, don't show again" aria-pressed={rated === -1} title="Bad question: hide it from Smart Study">
                <ThumbsDown className="size-4" />
              </button>
            </div>
          </div>

          {/* on phones the main action floats just above the bottom tab bar */}
          <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 -mx-4 mt-5 flex justify-center bg-gradient-to-t from-bg via-bg/95 to-transparent px-4 pt-6 pb-3 sm:static sm:mx-0 sm:bg-none sm:p-0">
            {result ? (
              <Button size="lg" onClick={loadNext} disabled={busy === "next"} autoFocus className="shadow-card">
                {busy === "next" ? <Loader2 className="size-4 animate-spin" /> : null} Next question
              </Button>
            ) : !instantPick ? (
              <Button size="lg" onClick={() => submit(value)} disabled={!isAnswered(q, value) || busy !== null} className="shadow-card">
                {busy === "answer" ? <Loader2 className="size-4 animate-spin" /> : null} Check answer
              </Button>
            ) : busy === "answer" ? (
              <Loader2 className="size-5 animate-spin text-muted" />
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
