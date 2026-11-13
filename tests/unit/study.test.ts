import { describe, expect, it } from "vitest";
import { expectedScore, levelFromMastery, targetDifficulty, updateMastery } from "@/lib/study/mastery";
import { buildStats, isDue, pickNextQuestion, reviewIntervalMs } from "@/lib/study/scheduler";
import { bucketOf, isCardDue, newFsrsState, review } from "@/lib/study/fsrs";
import { box2dToBox, hitTest, labelMatches } from "@/lib/diagram/geometry";
import type { Attempt, DiagramRegion, Question, Topic } from "@/lib/types";

const topic = (id: string, mastery: number): Topic => ({ id, user_id: "u", kit_id: "k", name: id, description: "", mastery, attempts: 0, correct: 0, created_at: "" });
const question = (id: string, topic_id: string, difficulty: 1 | 2 | 3 = 1, type: Question["type"] = "mcq"): Question => ({
  id, user_id: "u", kit_id: "k", topic_id, type, prompt: id, payload: { options: ["a", "b"] }, answer: { correct: [0] },
  explanation: "", difficulty, origin: "kit", diagram_id: null, verified: true, rating: 0, created_at: "",
});
const attempt = (qid: string, correct: boolean, at: number): Attempt => ({
  id: qid + at, user_id: "u", kit_id: "k", question_id: qid, topic_id: null, session_id: null, mode: "smart", correct, score: correct ? 1 : 0, response: 0, feedback: null, created_at: new Date(at).toISOString(),
});

describe("mastery", () => {
  it("rises on correct, falls on wrong, stays in 0..1", () => {
    expect(updateMastery(0.5, 2, 1, 0)).toBeGreaterThan(0.5);
    expect(updateMastery(0.5, 2, 0, 0)).toBeLessThan(0.5);
    expect(updateMastery(0.99, 1, 1, 0)).toBeLessThanOrEqual(1);
    expect(updateMastery(0.01, 3, 0, 0)).toBeGreaterThanOrEqual(0);
  });
  it("hard questions are worth more", () => {
    expect(updateMastery(0.5, 3, 1, 10) - 0.5).toBeGreaterThan(updateMastery(0.5, 1, 1, 10) - 0.5);
    expect(expectedScore(0.9, 1)).toBeGreaterThan(expectedScore(0.1, 1));
  });
  it("maps mastery to difficulty and level", () => {
    expect(targetDifficulty(0.1)).toBe(1);
    expect(targetDifficulty(0.5)).toBe(2);
    expect(targetDifficulty(0.9)).toBe(3);
    expect(levelFromMastery(0)).toEqual({ level: 1, pct: 0 });
    expect(levelFromMastery(0.37)).toEqual({ level: 4, pct: 70 });
  });
});

describe("scheduler", () => {
  it("prefers the weak topic", () => {
    const topics = [topic("weak", 0.05), topic("strong", 0.95)];
    const qs = [question("w1", "weak"), question("s1", "strong", 3)];
    let weakPicks = 0;
    let seed = 1;
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 200; i++) {
      const q = pickNextQuestion({ questions: qs, topics, stats: new Map(), recentIds: [], now: 0, random });
      if (q?.topic_id === "weak") weakPicks++;
    }
    expect(weakPicks).toBeGreaterThan(150);
  });
  it("does not repeat the question just shown when others exist", () => {
    const topics = [topic("t", 0.2)];
    const qs = [question("a", "t"), question("b", "t")];
    const q = pickNextQuestion({ questions: qs, topics, stats: new Map(), recentIds: ["a"], now: 0, random: () => 0.9 });
    expect(q?.id).toBe("b");
  });
  it("tracks streaks and spacing", () => {
    const stats = buildStats([attempt("a", true, 0), attempt("a", true, 1000), attempt("b", false, 0)]);
    expect(stats.get("a")!.streak).toBe(2);
    expect(stats.get("b")!.lastCorrect).toBe(false);
    expect(reviewIntervalMs(2)).toBe(40 * 60_000);
    expect(isDue(stats.get("a")!, 1000 + 39 * 60_000)).toBe(false);
    expect(isDue(stats.get("a")!, 1000 + 41 * 60_000)).toBe(true);
  });
  it("skips unverified and thumbs-down questions", () => {
    const q1 = { ...question("x", "t"), verified: false };
    const q2 = { ...question("y", "t"), rating: -1 };
    expect(pickNextQuestion({ questions: [q1, q2], topics: [topic("t", 0)], stats: new Map(), recentIds: [], now: 0 })).toBeNull();
  });
});

describe("fsrs wrapper", () => {
  it("schedules good later than again and buckets cards", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const s = newFsrsState(now);
    expect(bucketOf({ fsrs: s })).toBe("new");
    expect(isCardDue({ fsrs: s }, now)).toBe(true);
    const again = review(s, "again", now);
    const easy = review(s, "easy", now);
    expect(Date.parse(easy.due)).toBeGreaterThan(Date.parse(again.due));
    expect(bucketOf({ fsrs: again })).toBe("learning");
  });
});

describe("diagram geometry", () => {
  const r = (id: string, x: number, y: number, w: number, h: number): DiagramRegion => ({ id, label: id, box: { x, y, w, h }, labelBox: null, confirmed: true, seen: 0, correct: 0 });
  it("converts gemini boxes", () => {
    const b = box2dToBox([100, 200, 300, 600])!;
    expect(b.x).toBeCloseTo(0.2);
    expect(b.y).toBeCloseTo(0.1);
    expect(b.w).toBeCloseTo(0.4);
    expect(b.h).toBeCloseTo(0.2);
    expect(box2dToBox([1, 2, 3])).toBeNull();
  });
  it("hit test picks the smallest overlapping region", () => {
    const regions = [r("big", 0, 0, 1, 1), r("small", 0.4, 0.4, 0.1, 0.1)];
    expect(hitTest(regions, 0.45, 0.45)?.id).toBe("small");
    expect(hitTest(regions, 0.9, 0.9)?.id).toBe("big");
    expect(hitTest([r("a", 0.5, 0.5, 0.1, 0.1)], 0.1, 0.1)).toBeNull();
  });
  it("matches labels loosely", () => {
    expect(labelMatches("deltoid", "Deltoid")).toBe(true);
    expect(labelMatches("biceps brachi", "Biceps brachii")).toBe(true);
    expect(labelMatches("the trapezius muscle", "Trapezius")).toBe(true);
    expect(labelMatches("triceps", "Biceps brachii")).toBe(false);
    expect(labelMatches("C3", "C4 vertebra")).toBe(false);
    expect(labelMatches("structure 9", "Structure 3")).toBe(false);
    expect(labelMatches("c4 vertebra", "C4 vertebra")).toBe(true);
  });
});

import { contrast, derivePalette, rotateHue } from "@/lib/theme";

describe("custom theme", () => {
  it("keeps text readable on any background", () => {
    for (const bg of ["#000000", "#ffffff", "#808080", "#ff00ff", "#1a1033", "#fdf6e3", "#3b82f6"]) {
      const p = derivePalette({ background: bg, primary: "#2dd4bf", accent: "#fbbf24" });
      expect(contrast(p["--text"], bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p["--text"], p["--surface"])).toBeGreaterThanOrEqual(4.5);
    }
  });
  it("picks readable button text for the main colour", () => {
    for (const primary of ["#ffff00", "#000080", "#2dd4bf", "#c084fc", "#ef4444"]) {
      const p = derivePalette({ background: "#111111", primary, accent: "#fbbf24" });
      expect(contrast(p["--primary-ink"], primary)).toBeGreaterThanOrEqual(4.5);
    }
  });
  it("switches to light mode for light backgrounds", () => {
    expect(derivePalette({ background: "#fafafa", primary: "#0d9488", accent: "#b45309" })["color-scheme"]).toBe("light");
    expect(derivePalette({ background: "#101010", primary: "#0d9488", accent: "#b45309" })["color-scheme"]).toBe("dark");
    expect(rotateHue("#ff0000", 120)).toBe("#00ff00");
  });
});
