"use client";
import { ArrowDown, ArrowUp, Check, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { PublicQuestion } from "@/lib/api";
import type { ImageRef, QuestionAnswer } from "@/lib/types";
import { DiagramImage } from "@/components/diagram-image";
import { InlineMd } from "@/components/markdown";
import { cx } from "@/components/ui";

export type ResponseValue = number | null | number[] | (number | null)[] | string;

export function initialValue(q: PublicQuestion): ResponseValue {
  switch (q.type) {
    case "mcq":
    case "true_false":
      return null;
    case "multi_select":
      return [];
    case "matching":
      return (q.payload as { left: string[] }).left.map(() => null);
    case "ordering":
      return (q.payload as { items: string[] }).items.map((_, i) => i);
    case "short_answer":
      return "";
  }
}

export function isAnswered(q: PublicQuestion, v: ResponseValue) {
  if (q.type === "mcq" || q.type === "true_false") return v !== null;
  if (q.type === "multi_select") return (v as number[]).length > 0;
  if (q.type === "matching") return (v as (number | null)[]).every((x) => x !== null);
  if (q.type === "short_answer") return String(v).trim().length > 0;
  return true;
}

const OPT_BG = ["var(--opt-1)", "var(--opt-2)", "var(--opt-3)", "var(--opt-4)"];
const MARKERS = ["●", "▲", "■", "◆", "★", "✚"];
const MARKER_COLORS = ["#f87171", "#60a5fa", "#4ade80", "#c084fc", "#fbbf24", "#2dd4bf"];

interface Props {
  q: PublicQuestion;
  value: ResponseValue;
  onChange: (v: ResponseValue) => void;
  /** set once graded: shows right/wrong colouring */
  reveal?: { answer: QuestionAnswer } | null;
  /** Smart Study: picking an MCQ/TF option submits straight away */
  onPick?: (v: ResponseValue) => void;
  disabled?: boolean;
  compact?: boolean;
}

export function QuestionView({ q, value, onChange, reveal, onPick, disabled, compact }: Props) {
  const locked = disabled || Boolean(reveal);
  return (
    <div data-testid="question" data-qid={q.id}>
      {q.image && <DiagramImage image={q.image} maxHeight={compact ? 220 : 300} className="mb-4" alt="Diagram for this question" />}
      <div className={cx("font-semibold leading-snug", compact ? "text-base" : "text-lg sm:text-xl")}>
        <InlineMd>{q.prompt}</InlineMd>
      </div>
      {q.type === "multi_select" && <p className="mt-1 text-sm text-muted">Select all that apply.</p>}
      {q.type === "matching" && <p className="mt-1 text-sm text-muted">Tap an item on the left, then its match on the right.</p>}
      {q.type === "ordering" && <p className="mt-1 text-sm text-muted">Use the arrows to put these in the right order.</p>}
      <div className="mt-4">
        {(q.type === "mcq" || q.type === "true_false" || q.type === "multi_select") && (
          <Options q={q} value={value} onChange={onChange} onPick={onPick} reveal={reveal} locked={locked} />
        )}
        {q.type === "matching" && <Matching q={q} value={value as (number | null)[]} onChange={onChange} reveal={reveal} locked={locked} />}
        {q.type === "ordering" && <Ordering q={q} value={value as number[]} onChange={onChange} reveal={reveal} locked={locked} />}
        {q.type === "short_answer" && (
          <textarea
            value={value as string}
            onChange={(e) => onChange(e.target.value)}
            disabled={locked}
            rows={compact ? 3 : 4}
            placeholder="Type your answer in your own words…"
            className="w-full resize-y rounded-xl border border-border bg-surface-2 px-3 py-2.5 disabled:opacity-80"
            aria-label="Your answer"
          />
        )}
      </div>
    </div>
  );
}

function Options({ q, value, onChange, onPick, reveal, locked }: Omit<Props, "value"> & { value: ResponseValue; locked: boolean }) {
  const options = (q.payload as { options: string[] }).options;
  const optionImages = (q.payload as { optionImages?: ImageRef[] }).optionImages;
  const multi = q.type === "multi_select";
  const selected = multi ? (value as number[]) : value === null ? [] : [value as number];
  const correct = reveal ? (reveal.answer as { correct: number[] }).correct : [];

  const choose = (i: number) => {
    if (locked) return;
    if (multi) {
      const set = new Set(selected);
      if (set.has(i)) set.delete(i);
      else set.add(i);
      onChange([...set].sort((a, b) => a - b));
    } else {
      onChange(i);
      onPick?.(i);
    }
  };

  // number keys 1-9 pick options
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (locked || e.metaKey || e.ctrlKey || (e.target as HTMLElement)?.tagName === "TEXTAREA" || (e.target as HTMLElement)?.tagName === "INPUT") return;
      const n = Number(e.key);
      if (n >= 1 && n <= options.length) choose(n - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className={cx("grid gap-3", optionImages ? "grid-cols-2" : options.length <= 4 && options.every((o) => o.length < 90) ? "sm:grid-cols-2" : "")} role={multi ? "group" : "radiogroup"}>
      {options.map((opt, i) => {
        const isSel = selected.includes(i);
        const isRight = reveal && correct.includes(i);
        const isWrong = reveal && isSel && !correct.includes(i);
        return (
          <button
            key={i}
            type="button"
            role={multi ? "checkbox" : "radio"}
            aria-checked={isSel}
            onClick={() => choose(i)}
            disabled={locked && !reveal}
            className={cx(
              "flex min-h-14 items-center gap-3 rounded-xl border-2 text-left transition",
              optionImages ? "relative p-1.5" : "px-3 py-3",
              !reveal && isSel && "border-primary",
              !reveal && !isSel && "border-transparent hover:border-border",
              isRight && "border-good bg-good-soft",
              isWrong && "border-bad bg-bad-soft animate-shake",
              reveal && !isRight && !isWrong && "border-transparent opacity-70",
              locked ? "cursor-default" : "cursor-pointer active:scale-[0.99]",
            )}
            style={!isRight && !isWrong ? { background: isSel && !reveal ? "var(--surface-2)" : OPT_BG[i % 4] } : undefined}
          >
            <span
              className={cx(
                "grid shrink-0 place-items-center rounded-full font-bold",
                optionImages ? "absolute top-2.5 left-2.5 z-10 size-6 text-xs shadow-card" : "size-8 text-sm",
                isRight ? "bg-good text-white" : isWrong ? "bg-bad text-white" : multi && isSel ? "bg-primary text-primary-ink" : "bg-bg/60 text-text",
              )}
            >
              {isRight ? <Check className="size-4" /> : isWrong ? <X className="size-4" /> : multi && isSel ? <Check className="size-4" /> : i + 1}
            </span>
            {optionImages?.[i] ? (
              <span className="min-w-0 flex-1">
                <DiagramImage image={optionImages[i]} maxHeight={220} alt={opt} />
              </span>
            ) : (
              <span className="text-[0.95rem] leading-snug">
                <InlineMd>{opt}</InlineMd>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function Matching({ q, value, onChange, reveal, locked }: { q: PublicQuestion; value: (number | null)[]; onChange: (v: ResponseValue) => void; reveal?: Props["reveal"]; locked: boolean }) {
  const { left, right } = q.payload as { left: string[]; right: string[] };
  const [active, setActive] = useState<number | null>(null);
  const want = reveal ? (reveal.answer as { pairs: number[] }).pairs : null;
  const owner = useMemo(() => {
    const m = new Map<number, number>();
    value.forEach((r, l) => r !== null && m.set(r, l));
    return m;
  }, [value]);

  const pickRight = (r: number) => {
    if (locked || active === null) return;
    const next = value.map((x) => (x === r ? null : x));
    next[active] = r;
    onChange(next);
    const nextEmpty = next.findIndex((x) => x === null);
    setActive(nextEmpty === -1 ? null : nextEmpty);
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-2">
        {left.map((l, i) => {
          const ok = want && value[i] === want[i];
          return (
            <button
              key={i}
              type="button"
              data-testid="match-left"
              disabled={locked}
              onClick={() => setActive(i)}
              className={cx(
                "flex w-full items-center gap-2 rounded-xl border-2 bg-surface-2 px-3 py-2.5 text-left text-sm",
                active === i ? "border-primary" : "border-transparent",
                want && (ok ? "border-good bg-good-soft" : "border-bad bg-bad-soft"),
              )}
            >
              <span style={{ color: MARKER_COLORS[i % 6] }} aria-hidden>{MARKERS[i % 6]}</span>
              <span className="flex-1"><InlineMd>{l}</InlineMd></span>
            </button>
          );
        })}
      </div>
      <div className="space-y-2">
        {right.map((r, j) => {
          const l = owner.get(j);
          return (
            <button
              key={j}
              type="button"
              data-testid="match-right"
              disabled={locked}
              onClick={() => pickRight(j)}
              className={cx("flex w-full items-center gap-2 rounded-xl border-2 border-transparent bg-surface px-3 py-2.5 text-left text-sm", !locked && active !== null && "hover:border-primary/60")}
            >
              <span className="w-4 shrink-0 text-center" style={{ color: l !== undefined ? MARKER_COLORS[l % 6] : undefined }} aria-hidden>
                {l !== undefined ? MARKERS[l % 6] : "○"}
              </span>
              <span className="flex-1"><InlineMd>{r}</InlineMd></span>
            </button>
          );
        })}
      </div>
      {want && (
        <div className="col-span-2 rounded-xl bg-surface-2 p-3 text-sm">
          <div className="mb-1 font-semibold">Correct pairs</div>
          {left.map((l, i) => (
            <div key={i}>
              <span style={{ color: MARKER_COLORS[i % 6] }}>{MARKERS[i % 6]}</span> {l} → {right[want[i]]}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Ordering({ q, value, onChange, reveal, locked }: { q: PublicQuestion; value: number[]; onChange: (v: ResponseValue) => void; reveal?: Props["reveal"]; locked: boolean }) {
  const items = (q.payload as { items: string[] }).items;
  const want = reveal ? (reveal.answer as { order: number[] }).order : null;
  const move = (pos: number, dir: -1 | 1) => {
    const next = [...value];
    const to = pos + dir;
    if (to < 0 || to >= next.length) return;
    [next[pos], next[to]] = [next[to], next[pos]];
    onChange(next);
  };
  return (
    <ol className="space-y-2">
      {value.map((itemIdx, pos) => {
        const ok = want && want[pos] === itemIdx;
        return (
          <li key={itemIdx} className={cx("flex items-center gap-2 rounded-xl border-2 bg-surface-2 px-3 py-2", want ? (ok ? "border-good bg-good-soft" : "border-bad bg-bad-soft") : "border-transparent")}>
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-bg/60 text-sm font-bold">{pos + 1}</span>
            <span className="flex-1 text-sm"><InlineMd>{items[itemIdx]}</InlineMd></span>
            {!locked && (
              <span className="flex gap-1">
                <button type="button" onClick={() => move(pos, -1)} disabled={pos === 0} className="grid size-8 place-items-center rounded-lg hover:bg-bg/60 disabled:opacity-30" aria-label="Move up">
                  <ArrowUp className="size-4" />
                </button>
                <button type="button" onClick={() => move(pos, 1)} disabled={pos === value.length - 1} className="grid size-8 place-items-center rounded-lg hover:bg-bg/60 disabled:opacity-30" aria-label="Move down">
                  <ArrowDown className="size-4" />
                </button>
              </span>
            )}
          </li>
        );
      })}
      {want && (
        <li className="rounded-xl bg-surface-2 p-3 text-sm">
          <div className="mb-1 font-semibold">Correct order</div>
          {want.map((i, k) => (
            <div key={i}>{k + 1}. {items[i]}</div>
          ))}
        </li>
      )}
    </ol>
  );
}
