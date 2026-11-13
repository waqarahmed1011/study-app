"use client";
import { ArrowLeft, Check, Eye, EyeOff, Loader2, MousePointerClick, Pencil, Plus, ScanSearch, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/client";
import { clampBox, hitTest, labelMatches } from "@/lib/diagram/geometry";
import { describeAnswer } from "@/lib/study/questions";
import type { Box, Diagram, DiagramRegion, Question } from "@/lib/types";
import { InlineMd } from "@/components/markdown";
import { Badge, Button, Card, cx, ErrorNote } from "@/components/ui";

type Mode = "edit" | "hide" | "tap" | "facts";

const pct = (b: Box) => ({ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%` });

function relPoint(e: { clientX: number; clientY: number }, el: HTMLElement) {
  const r = el.getBoundingClientRect();
  return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
}

/** Weakest regions first, with a little randomness so the order isn't fixed. */
function studyOrder(regions: DiagramRegion[]) {
  return [...regions]
    .map((r) => ({ r, k: (r.seen ? r.correct / r.seen : 0) + Math.random() * 0.35 }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.r);
}

export function DiagramStudio({ kitId, diagram, image }: { kitId: string; diagram: Diagram; image: string }) {
  const router = useRouter();
  const [regions, setRegions] = useState<DiagramRegion[]>(diagram.regions);
  const [title, setTitle] = useState(diagram.title);
  const [mode, setMode] = useState<Mode>(diagram.status === "draft" || !diagram.regions.some((r) => r.confirmed) ? "edit" : "hide");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirmed = regions.filter((r) => r.confirmed);
  const dirty = useRef(false);

  // autosave edits
  useEffect(() => {
    if (!dirty.current) return;
    const t = setTimeout(async () => {
      setSaving(true);
      try {
        await api(`/api/diagrams/${diagram.id}`, { method: "PATCH", body: { regions, title } });
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setSaving(false);
      }
    }, 600);
    return () => clearTimeout(t);
  }, [regions, title, diagram.id]);

  const update = (next: DiagramRegion[]) => {
    dirty.current = true;
    setRegions(next);
  };

  async function finishEditing() {
    await api(`/api/diagrams/${diagram.id}`, { method: "PATCH", body: { regions, title, status: "confirmed" } });
    setMode("hide");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link href={`/kits/${kitId}/diagrams`} className="grid size-9 place-items-center rounded-full text-muted hover:bg-surface-2" aria-label="Back to diagrams">
          <ArrowLeft className="size-5" />
        </Link>
        {mode === "edit" ? (
          <input value={title} onChange={(e) => { dirty.current = true; setTitle(e.target.value); }} className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-2 py-1 text-lg font-bold" aria-label="Diagram title" />
        ) : (
          <h2 className="min-w-0 flex-1 truncate text-lg font-bold">{title}</h2>
        )}
        {saving && <Loader2 className="size-4 animate-spin text-muted" />}
      </div>

      <div className="mb-4 flex gap-1 overflow-x-auto rounded-full bg-surface-2 p-1 text-sm" role="tablist">
        {(
          [
            ["edit", "Edit labels", Pencil],
            ["hide", "Label quiz", EyeOff],
            ["tap", "Tap to find", MousePointerClick],
            ["facts", "Fact questions", Sparkles],
          ] as const
        ).map(([m, label, Icon]) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            disabled={m !== "edit" && !confirmed.length}
            onClick={() => setMode(m)}
            className={cx("flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 font-semibold disabled:opacity-40", mode === m ? "bg-surface text-text shadow-card" : "text-muted")}
          >
            <Icon className="size-4" /> {label}
          </button>
        ))}
      </div>

      {error && <div className="mb-4"><ErrorNote>{error}</ErrorNote></div>}

      {mode === "edit" && <Editor diagramId={diagram.id} image={image} regions={regions} onChange={update} onDone={finishEditing} onError={setError} />}
      {mode === "hide" && <HideQuiz diagramId={diagram.id} image={image} regions={confirmed} />}
      {mode === "tap" && <TapQuiz diagramId={diagram.id} image={image} regions={confirmed} />}
      {mode === "facts" && <Facts diagramId={diagram.id} />}
    </div>
  );
}

/* ---------------------------------- editor --------------------------------- */

type Drag =
  | { kind: "draw"; target: "box" | "labelBox"; start: { x: number; y: number }; id: string }
  | { kind: "move"; target: "box" | "labelBox"; start: { x: number; y: number }; orig: Box; id: string }
  | { kind: "resize"; target: "box" | "labelBox"; start: { x: number; y: number }; orig: Box; id: string };

function Editor({ diagramId, image, regions, onChange, onDone, onError }: { diagramId: string; image: string; regions: DiagramRegion[]; onChange: (r: DiagramRegion[]) => void; onDone: () => void; onError: (e: string) => void }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(regions[0]?.id ?? null);
  const [drawTarget, setDrawTarget] = useState<"box" | "labelBox" | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [detecting, setDetecting] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  const patch = (id: string, p: Partial<DiagramRegion>) => onChange(regions.map((r) => (r.id === id ? { ...r, ...p } : r)));

  function addRegion() {
    const id = Math.random().toString(36).slice(2, 10);
    onChange([...regions, { id, label: "", box: { x: 0.4, y: 0.4, w: 0.15, h: 0.1 }, labelBox: null, confirmed: false, seen: 0, correct: 0 }]);
    setSelected(id);
    setDrawTarget("box");
  }

  async function redetect() {
    if (regions.length && !confirm("Replace all current labels with a fresh AI detection?")) return;
    setDetecting(true);
    try {
      const d = await api<Diagram>(`/api/diagrams/${diagramId}/detect`, { body: {} });
      onChange(d.regions);
      setSelected(d.regions[0]?.id ?? null);
      router.refresh();
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setDetecting(false);
    }
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!wrap.current || !drawTarget || !selected) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setDrag({ kind: "draw", target: drawTarget, start: relPoint(e, wrap.current), id: selected });
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag || !wrap.current) return;
    const p = relPoint(e, wrap.current);
    const r = regions.find((x) => x.id === drag.id);
    if (!r) return;
    let box: Box;
    if (drag.kind === "draw") {
      box = { x: Math.min(drag.start.x, p.x), y: Math.min(drag.start.y, p.y), w: Math.abs(p.x - drag.start.x), h: Math.abs(p.y - drag.start.y) };
    } else if (drag.kind === "move") {
      box = { ...drag.orig, x: drag.orig.x + p.x - drag.start.x, y: drag.orig.y + p.y - drag.start.y };
    } else {
      box = { ...drag.orig, w: Math.max(0.01, drag.orig.w + p.x - drag.start.x), h: Math.max(0.01, drag.orig.h + p.y - drag.start.y) };
    }
    patch(drag.id, { [drag.target]: clampBox(box) } as Partial<DiagramRegion>);
  }

  function onPointerUp() {
    if (drag?.kind === "draw") setDrawTarget(null);
    setDrag(null);
  }

  const startMove = (e: React.PointerEvent, r: DiagramRegion, target: "box" | "labelBox", kind: "move" | "resize") => {
    if (!wrap.current || drawTarget) return;
    e.stopPropagation();
    e.preventDefault();
    setSelected(r.id);
    const orig = r[target];
    if (!orig) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setDrag({ kind, target, start: relPoint(e, wrap.current), orig, id: r.id });
  };

  const sel = regions.find((r) => r.id === selected);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div>
        <div
          ref={wrap}
          className={cx("relative select-none overflow-hidden rounded-2xl border border-border bg-white", drawTarget && "cursor-crosshair")}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          style={{ touchAction: drawTarget || drag ? "none" : "auto" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt="Diagram" className="block w-full" draggable={false} />
          {regions.map((r) => (
            <div key={r.id}>
              <div
                onPointerDown={(e) => startMove(e, r, "box", "move")}
                className={cx("absolute rounded-md border-2", r.id === selected ? "border-primary bg-primary/15" : r.confirmed ? "border-good/80" : "border-accent/80 border-dashed")}
                style={pct(r.box)}
                title={r.label}
              >
                {r.id === selected && (
                  <span onPointerDown={(e) => startMove(e, r, "box", "resize")} className="absolute -right-1.5 -bottom-1.5 size-4 cursor-se-resize rounded-sm bg-primary" />
                )}
              </div>
              {r.labelBox && (
                <div
                  onPointerDown={(e) => startMove(e, r, "labelBox", "move")}
                  className={cx("absolute rounded border-2 border-dashed", r.id === selected ? "border-accent bg-accent/25" : "border-accent/50")}
                  style={pct(r.labelBox)}
                >
                  {r.id === selected && (
                    <span onPointerDown={(e) => startMove(e, r, "labelBox", "resize")} className="absolute -right-1.5 -bottom-1.5 size-3.5 cursor-se-resize rounded-sm bg-accent" />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">
          <span className="font-semibold text-primary">Solid box</span> = the structure (what you tap). <span className="font-semibold text-accent">Dashed box</span> = the printed label (hidden in the quiz). Drag to move, corner to resize.
          {drawTarget && <span className="ml-1 font-semibold text-text">Now drag on the image to draw the {drawTarget === "box" ? "structure" : "label cover"}.</span>}
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={addRegion}><Plus className="size-4" /> Add</Button>
          <Button size="sm" variant="secondary" onClick={redetect} disabled={detecting}>
            {detecting ? <Loader2 className="size-4 animate-spin" /> : <ScanSearch className="size-4" />} AI detect
          </Button>
          <Button size="sm" variant="secondary" onClick={() => onChange(regions.map((r) => (r.label.trim() ? { ...r, confirmed: true } : r)))}>
            <Check className="size-4" /> Confirm all
          </Button>
        </div>

        {sel && (
          <Card className="space-y-2 p-3">
            <input value={sel.label} onChange={(e) => patch(sel.id, { label: e.target.value })} placeholder="Structure name" className="w-full rounded-lg border border-border bg-surface-2 px-2 py-1.5 font-semibold" aria-label="Selected label" autoFocus={!sel.label} />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant={drawTarget === "box" ? "primary" : "secondary"} onClick={() => setDrawTarget("box")}>Redraw area</Button>
              <Button size="sm" variant={drawTarget === "labelBox" ? "primary" : "secondary"} onClick={() => setDrawTarget("labelBox")}>{sel.labelBox ? "Redraw label" : "Add label cover"}</Button>
              {sel.labelBox && <Button size="sm" variant="ghost" onClick={() => patch(sel.id, { labelBox: null })}>No label</Button>}
            </div>
          </Card>
        )}

        <ul className="max-h-[50vh] space-y-1 overflow-auto pr-1">
          {regions.map((r) => (
            <li key={r.id} className={cx("flex items-center gap-2 rounded-xl px-2 py-1.5", r.id === selected ? "bg-surface-2" : "hover:bg-surface-2/60")}>
              <input type="checkbox" checked={r.confirmed} onChange={(e) => patch(r.id, { confirmed: e.target.checked })} className="size-4 accent-[var(--good)]" aria-label={`Confirm ${r.label || "region"}`} />
              <button type="button" onClick={() => setSelected(r.id)} className="min-w-0 flex-1 truncate text-left text-sm">
                {r.label || <span className="text-muted italic">unnamed</span>}
              </button>
              <button type="button" onClick={() => onChange(regions.filter((x) => x.id !== r.id))} className="grid size-7 place-items-center rounded-full text-muted hover:text-bad" aria-label={`Delete ${r.label}`}>
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted">Tick each label once it&apos;s right. Only ticked labels are used for studying.</p>
        <Button className="w-full" onClick={onDone} disabled={!regions.some((r) => r.confirmed && r.label.trim())}>
          Start studying
        </Button>
      </div>
    </div>
  );
}

/* -------------------------------- hide quiz -------------------------------- */

function useQuizQueue(regions: DiagramRegion[]) {
  const [queue, setQueue] = useState(() => studyOrder(regions));
  const [stats, setStats] = useState({ right: 0, total: 0 });
  const current = queue[0];
  const advance = (correct: boolean) => {
    setStats((s) => ({ right: s.right + (correct ? 1 : 0), total: s.total + 1 }));
    setQueue((q) => {
      const [head, ...rest] = q;
      if (!head) return q;
      // missed ones come back a few turns later; when a round is done, start a new one
      const next = correct ? rest : [...rest.slice(0, 2), head, ...rest.slice(2)];
      return next.length ? next : studyOrder(regions);
    });
  };
  return { current, advance, stats };
}

async function recordAttempt(diagramId: string, regionId: string, correct: boolean, response: string) {
  await api(`/api/diagrams/${diagramId}/attempt`, { body: { regionId, correct, response } }).catch(() => {});
}

function HideQuiz({ diagramId, image, regions }: { diagramId: string; image: string; regions: DiagramRegion[] }) {
  const { current, advance, stats } = useQuizQueue(regions);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<null | boolean>(null);
  const [revealAll, setRevealAll] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const numbers = useMemo(() => new Map(regions.map((r, i) => [r.id, i + 1])), [regions]);

  function check() {
    if (!current || result !== null) return;
    const ok = labelMatches(answer, current.label);
    setResult(ok);
    recordAttempt(diagramId, current.id, ok, answer);
  }
  function next(overrideCorrect?: boolean) {
    advance(overrideCorrect ?? Boolean(result));
    setAnswer("");
    setResult(null);
    setTimeout(() => input.current?.focus(), 0);
  }

  if (!current) return null;
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image} alt="Diagram with labels hidden" className="block w-full" draggable={false} />
        {regions.map((r) => {
          const isCur = r.id === current.id;
          const shown = revealAll || (isCur && result !== null);
          return (
            <div key={r.id}>
              {r.labelBox && (
                <div className={cx("absolute grid place-items-center overflow-hidden rounded text-[10px] font-bold sm:text-xs", shown ? "bg-white/90 text-black ring-2" : "bg-slate-700 text-white", isCur ? "ring-2 ring-[var(--accent)]" : "", shown && (isCur ? (result ? "ring-[var(--good)]" : "ring-[var(--bad)]") : "ring-transparent"))} style={pct(r.labelBox)}>
                  {shown ? r.label : numbers.get(r.id)}
                </div>
              )}
              {isCur && <div className="pointer-events-none absolute animate-pulse rounded-md border-[3px] border-[var(--accent)]" style={pct(r.box)} />}
              {!r.labelBox && !isCur && revealAll && (
                <div className="absolute grid place-items-center text-[10px] font-bold text-black" style={pct(r.box)}><span className="rounded bg-white/85 px-1">{r.label}</span></div>
              )}
            </div>
          );
        })}
      </div>

      <Card className="h-fit space-y-3 p-4">
        <div className="text-sm text-muted">Name the highlighted structure{current.labelBox ? ` (label #${numbers.get(current.id)})` : ""}.</div>
        <input
          ref={input}
          autoFocus
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (result === null ? check() : next())}
          disabled={result !== null}
          placeholder="Type the name…"
          className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2.5"
          aria-label="Structure name"
        />
        {result === null ? (
          <div className="flex gap-2">
            <Button className="flex-1" onClick={check} disabled={!answer.trim()}>Check</Button>
            <Button variant="ghost" onClick={() => { setResult(false); recordAttempt(diagramId, current.id, false, ""); }}>Show</Button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className={cx("rounded-xl p-3 text-sm font-semibold", result ? "bg-good-soft text-good" : "bg-bad-soft text-bad")}>
              {result ? "Correct" : "Answer"}: {current.label}
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => next()} autoFocus>Next</Button>
              {!result && answer.trim() && (
                <Button variant="secondary" onClick={() => { recordAttempt(diagramId, current.id, true, answer + " (self-marked)"); next(true); }}>I was right</Button>
              )}
            </div>
          </div>
        )}
        <div className="flex items-center justify-between text-xs text-muted">
          <span>{stats.right}/{stats.total} correct this session</span>
          <button type="button" onClick={() => setRevealAll((v) => !v)} className="flex items-center gap-1 hover:text-text">
            {revealAll ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />} {revealAll ? "Hide" : "Peek"} all
          </button>
        </div>
      </Card>
    </div>
  );
}

/* --------------------------------- tap quiz -------------------------------- */

function TapQuiz({ diagramId, image, regions }: { diagramId: string; image: string; regions: DiagramRegion[] }) {
  const { current, advance, stats } = useQuizQueue(regions);
  const [feedback, setFeedback] = useState<null | { ok: boolean; tapped: DiagramRegion | null; at: { x: number; y: number } }>(null);
  const wrap = useRef<HTMLDivElement>(null);

  function tap(e: React.MouseEvent) {
    if (!current || !wrap.current || feedback) return;
    const p = relPoint(e, wrap.current);
    const hit = hitTest(regions, p.x, p.y);
    const ok = hit?.id === current.id;
    setFeedback({ ok, tapped: hit, at: p });
    recordAttempt(diagramId, current.id, ok, hit?.label ?? "missed");
  }

  function next() {
    if (!feedback) return;
    advance(feedback.ok);
    setFeedback(null);
  }

  if (!current) return null;
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div ref={wrap} onClick={tap} className="relative cursor-crosshair overflow-hidden rounded-2xl border border-border bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image} alt="Diagram, tap the named structure" className="block w-full" draggable={false} />
        {/* printed labels are covered so they don't give the answer away */}
        {regions.map((r) => r.labelBox && <div key={r.id} className="absolute rounded bg-slate-700" style={pct(r.labelBox)} />)}
        {feedback && (
          <>
            <div className={cx("pointer-events-none absolute rounded-md border-[3px]", "border-[var(--good)] bg-[var(--good-soft)]")} style={pct(current.box)} />
            {!feedback.ok && feedback.tapped && <div className="pointer-events-none absolute rounded-md border-[3px] border-[var(--bad)]" style={pct(feedback.tapped.box)} />}
            <span className={cx("pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white", feedback.ok ? "bg-[var(--good)]" : "bg-[var(--bad)]")} style={{ left: `${feedback.at.x * 100}%`, top: `${feedback.at.y * 100}%` }} />
          </>
        )}
      </div>
      <Card className="h-fit space-y-3 p-4">
        <div className="text-sm text-muted">Tap the</div>
        <div className="text-2xl font-bold">{current.label}</div>
        {feedback && (
          <div className={cx("rounded-xl p-3 text-sm font-semibold", feedback.ok ? "bg-good-soft text-good" : "bg-bad-soft text-bad")}>
            {feedback.ok ? "Correct!" : feedback.tapped ? `That's the ${feedback.tapped.label}. The green box is the ${current.label}.` : `Missed. The green box is the ${current.label}.`}
          </div>
        )}
        <Button className="w-full" onClick={next} disabled={!feedback}>Next</Button>
        <div className="text-xs text-muted">{stats.right}/{stats.total} correct this session</div>
      </Card>
    </div>
  );
}

/* ---------------------------------- facts ---------------------------------- */

function Facts({ diagramId }: { diagramId: string }) {
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ questions: Question[] }>(`/api/diagrams/${diagramId}/facts`).then((r) => setQuestions(r.questions));
  }, [diagramId]);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/diagrams/${diagramId}/facts`, { body: {} });
      const r = await api<{ questions: Question[] }>(`/api/diagrams/${diagramId}/facts`);
      setQuestions(r.questions);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function setVerified(q: Question, verified: boolean) {
    setQuestions((qs) => qs?.map((x) => (x.id === q.id ? { ...x, verified } : x)) ?? null);
    await api(`/api/questions/${q.id}`, { method: "PATCH", body: { verified } });
  }

  async function remove(q: Question) {
    setQuestions((qs) => qs?.filter((x) => x.id !== q.id) ?? null);
    await api(`/api/questions/${q.id}`, { method: "DELETE" });
  }

  const unverified = questions?.filter((q) => !q.verified).length ?? 0;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Card className="border-accent/50 p-4 text-sm">
        <div className="font-semibold text-accent">AI-written facts can be wrong</div>
        <p className="mt-1 text-muted">
          Check each one against your notes or textbook. Verified questions join Smart Study and practice tests; unverified ones never do.
        </p>
        <Button className="mt-3" onClick={generate} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} {questions?.length ? "Regenerate unverified" : "Write fact questions"}
        </Button>
      </Card>
      {error && <ErrorNote>{error}</ErrorNote>}
      {questions && questions.length > 0 && <p className="text-sm text-muted">{questions.length} questions · {unverified} to check</p>}
      <ul className="space-y-3">
        {questions?.map((q) => (
          <Card key={q.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium"><InlineMd>{q.prompt}</InlineMd></div>
                <div className="mt-1 text-sm"><span className="font-semibold">Answer: </span><InlineMd>{describeAnswer(q)}</InlineMd></div>
                {q.explanation && <div className="mt-1 text-xs text-muted"><InlineMd>{q.explanation}</InlineMd></div>}
              </div>
              <button type="button" onClick={() => remove(q)} className="grid size-8 shrink-0 place-items-center rounded-full text-muted hover:text-bad" aria-label="Delete question">
                <Trash2 className="size-4" />
              </button>
            </div>
            <div className="mt-3 flex items-center gap-2">
              {q.verified ? <Badge tone="good">Verified</Badge> : <Badge tone="accent">Unverified</Badge>}
              <Button size="sm" variant={q.verified ? "ghost" : "secondary"} onClick={() => setVerified(q, !q.verified)}>
                {q.verified ? "Unverify" : <><Check className="size-4" /> Looks right</>}
              </Button>
            </div>
          </Card>
        ))}
      </ul>
    </div>
  );
}
