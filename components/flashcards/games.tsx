"use client";
import { Grid3x3, Play, Timer, Trophy, Zap } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Flashcard } from "@/lib/types";
import { Button, Card, cx } from "@/components/ui";

function shuffle<T>(a: T[]) {
  const out = [...a];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function getBest(key: string) {
  try {
    return Number(localStorage.getItem(key)) || null;
  } catch {
    return null;
  }
}
function setBest(key: string, v: number) {
  try {
    localStorage.setItem(key, String(v));
  } catch {}
}

const strip = (s: string) => s.replace(/[$*_#`]/g, "");
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

export function Games({ cards: all }: { cards: Flashcard[] }) {
  // the games are text-only, so picture cards sit them out
  const cards = all.filter((c) => !c.front_image && !c.back_image && c.front.trim() && c.back.trim());
  const [game, setGame] = useState<"match" | "speed" | null>(null);
  if (game === "match") return <MatchGame cards={cards} onExit={() => setGame(null)} />;
  if (game === "speed") return <SpeedRound cards={cards} onExit={() => setGame(null)} />;
  const tooFew = cards.length < 4;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card className="p-5">
        <Grid3x3 className="size-8 text-primary" />
        <h3 className="mt-3 text-lg font-bold">Match</h3>
        <p className="mt-1 text-sm text-muted">Clear the board by pairing each term with its definition. Beat your best time.</p>
        <Button className="mt-4" onClick={() => setGame("match")} disabled={tooFew}>
          <Play className="size-4" /> Play
        </Button>
      </Card>
      <Card className="p-5">
        <Zap className="size-8 text-accent" />
        <h3 className="mt-3 text-lg font-bold">Speed round</h3>
        <p className="mt-1 text-sm text-muted">60 seconds. Read the definition, hit the right term. Streaks score double.</p>
        <Button className="mt-4" onClick={() => setGame("speed")} disabled={tooFew}>
          <Play className="size-4" /> Play
        </Button>
      </Card>
      {tooFew && <p className="text-sm text-muted sm:col-span-2">Games need at least 4 flashcards.</p>}
    </div>
  );
}

function MatchGame({ cards, onExit }: { cards: Flashcard[]; onExit: () => void }) {
  const [round, setRound] = useState(0);
  const tiles = useMemo(() => {
    const pick = shuffle(cards).slice(0, 6);
    return shuffle(pick.flatMap((c) => [
      { key: c.id + "f", pair: c.id, text: clip(strip(c.front), 60) },
      { key: c.id + "b", pair: c.id, text: clip(strip(c.back), 90) },
    ]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards, round]);
  const [selected, setSelected] = useState<string | null>(null);
  const [cleared, setCleared] = useState<Set<string>>(new Set());
  const [wrong, setWrong] = useState<string[]>([]);
  const [startAt, setStartAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [penalty, setPenalty] = useState(0);
  const done = cleared.size === tiles.length;
  const best = getBest("best-match");

  useEffect(() => {
    if (done) return;
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, [done]);

  const elapsed = (now - startAt) / 1000 + penalty;
  useEffect(() => {
    if (done && (!best || elapsed < best)) setBest("best-match", Number(elapsed.toFixed(1)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  function tap(key: string) {
    if (cleared.has(key) || wrong.length) return;
    if (!selected) return setSelected(key);
    if (selected === key) return setSelected(null);
    const a = tiles.find((t) => t.key === selected)!;
    const b = tiles.find((t) => t.key === key)!;
    if (a.pair === b.pair) {
      setCleared((s) => new Set([...s, a.key, b.key]));
      setSelected(null);
    } else {
      setWrong([a.key, b.key]);
      setPenalty((p) => p + 1);
      setTimeout(() => {
        setWrong([]);
        setSelected(null);
      }, 500);
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onExit}>← Games</Button>
        <div className="flex items-center gap-2 font-mono text-lg font-bold"><Timer className="size-5 text-muted" /> {elapsed.toFixed(1)}s</div>
        <div className="text-sm text-muted">{best ? `Best ${best}s` : ""}</div>
      </div>
      {done ? (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <Trophy className="size-10 text-accent" />
          <div className="text-xl font-bold">Cleared in {elapsed.toFixed(1)}s</div>
          {penalty > 0 && <p className="text-sm text-muted">Includes +{penalty}s for mismatches.</p>}
          <Button onClick={() => { setRound((r) => r + 1); setCleared(new Set()); setPenalty(0); setStartAt(Date.now()); setNow(Date.now()); }}>Play again</Button>
        </Card>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {tiles.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => tap(t.key)}
              className={cx(
                "min-h-24 rounded-xl border-2 p-2 text-xs transition sm:text-sm",
                cleared.has(t.key) ? "invisible" : "bg-surface",
                selected === t.key ? "border-primary" : "border-border",
                wrong.includes(t.key) && "animate-shake border-bad bg-bad-soft",
              )}
            >
              {t.text}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SpeedRound({ cards, onExit }: { cards: Flashcard[]; onExit: () => void }) {
  const DURATION = 60;
  const [running, setRunning] = useState(false);
  const [left, setLeft] = useState(DURATION);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [flash, setFlash] = useState<"good" | "bad" | null>(null);
  const [card, setCard] = useState<Flashcard>(() => cards[0]);
  const [options, setOptions] = useState<Flashcard[]>([]);
  const order = useRef<Flashcard[]>([]);
  const scoreRef = useRef(0);
  const endsAt = useRef(0);
  const best = getBest("best-speed");

  function deal() {
    if (!order.current.length) order.current = shuffle(cards);
    const c = order.current.pop()!;
    setCard(c);
    setOptions(shuffle([c, ...shuffle(cards.filter((x) => x.id !== c.id)).slice(0, 3)]));
  }

  function start() {
    scoreRef.current = 0;
    setScore(0);
    setStreak(0);
    setLeft(DURATION);
    // start() only runs from a click handler, never during render
    // eslint-disable-next-line react-hooks/purity
    endsAt.current = Date.now() + DURATION * 1000;
    setRunning(true);
    deal();
  }

  // the timer ends the round from its own callback, so no effect has to react to it
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endsAt.current - Date.now()) / 1000));
      setLeft(remaining);
      if (remaining <= 0) {
        clearInterval(t);
        setRunning(false);
        const prev = getBest("best-speed");
        if (!prev || scoreRef.current > prev) setBest("best-speed", scoreRef.current);
      }
    }, 250);
    return () => clearInterval(t);
  }, [running]);

  function answer(c: Flashcard) {
    if (!running) return;
    if (c.id === card.id) {
      scoreRef.current += streak >= 2 ? 2 : 1;
      setScore(scoreRef.current);
      setStreak((s) => s + 1);
      setFlash("good");
    } else {
      setStreak(0);
      setFlash("bad");
    }
    setTimeout(() => setFlash(null), 250);
    deal();
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onExit}>← Games</Button>
        <div className="font-mono text-lg font-bold">{left}s</div>
        <div className="text-sm font-semibold">Score {score}{streak >= 2 && <span className="ml-1 text-accent">×2</span>}</div>
      </div>
      {!running ? (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <Zap className="size-10 text-accent" />
          {left <= 0 ? <div className="text-xl font-bold">Time! You scored {score}.</div> : <div className="text-xl font-bold">Ready?</div>}
          {best !== null && <p className="text-sm text-muted">Best: {Math.max(best, score)}</p>}
          <Button onClick={start}>{left <= 0 ? "Play again" : "Start"}</Button>
        </Card>
      ) : (
        <>
          <Card className={cx("mb-4 grid min-h-32 place-items-center p-5 text-center transition", flash === "good" && "border-good bg-good-soft", flash === "bad" && "border-bad bg-bad-soft")}>
            <p className="text-base sm:text-lg">{clip(strip(card.back), 220)}</p>
          </Card>
          <div className="grid grid-cols-2 gap-2">
            {options.map((o) => (
              <button key={o.id} type="button" onClick={() => answer(o)} className="min-h-16 rounded-xl border-2 border-border bg-surface p-3 text-sm font-semibold hover:border-primary">
                {clip(strip(o.front), 60)}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
