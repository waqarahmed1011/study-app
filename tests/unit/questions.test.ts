import { describe, expect, it } from "vitest";
import { describeAnswer, gradeObjective, normaliseQuestion } from "@/lib/study/questions";
import type { RawQuestion } from "@/lib/ai/schemas";

const raw = (over: Partial<RawQuestion>): RawQuestion => ({
  topic: "Cells", type: "mcq", prompt: "What makes ATP?", difficulty: 2,
  options: [], correct_indices: [], answer_text: "", pairs: [], order: [], explanation: "", ...over,
});

describe("normaliseQuestion", () => {
  it("shuffles MCQ options but keeps the right answer", () => {
    const q = normaliseQuestion(raw({ options: ["Mitochondria", "Nucleus", "Ribosome", "Golgi"], correct_indices: [0] }))!;
    const opts = (q.payload as { options: string[] }).options;
    const correct = (q.answer as { correct: number[] }).correct;
    expect(opts).toHaveLength(4);
    expect(opts[correct[0]]).toBe("Mitochondria");
    expect(gradeObjective("mcq", q.answer, correct[0])).toEqual({ correct: true, score: 1 });
    expect(gradeObjective("mcq", q.answer, (correct[0] + 1) % 4)!.correct).toBe(false);
  });

  it("drops MCQs with no valid correct index", () => {
    expect(normaliseQuestion(raw({ options: ["a", "b"], correct_indices: [5] }))).toBeNull();
  });

  it("maps true/false by text even if the model swaps the order", () => {
    const q = normaliseQuestion(raw({ type: "true_false", options: ["False", "True"], correct_indices: [0] }))!;
    expect((q.payload as { options: string[] }).options).toEqual(["True", "False"]);
    expect((q.answer as { correct: number[] }).correct).toEqual([1]);
  });

  it("grades matching with partial credit", () => {
    const q = normaliseQuestion(raw({ type: "matching", prompt: "Match organelles", pairs: [
      { left: "Nucleus", right: "Stores DNA" }, { left: "Mitochondria", right: "Makes ATP" }, { left: "Ribosome", right: "Makes protein" },
    ] }))!;
    const want = (q.answer as { pairs: number[] }).pairs;
    expect(gradeObjective("matching", q.answer, want)!.score).toBe(1);
    const p = q.payload as { left: string[]; right: string[] };
    want.forEach((r, i) => {
      const left = p.left[i];
      const right = p.right[r];
      expect({ Nucleus: "Stores DNA", Mitochondria: "Makes ATP", Ribosome: "Makes protein" }[left]).toBe(right);
    });
    const oneWrong = [...want]; [oneWrong[0], oneWrong[1]] = [oneWrong[1], oneWrong[0]];
    expect(gradeObjective("matching", q.answer, oneWrong)!.score).toBeCloseTo(1 / 3);
  });

  it("ordering is never shown already solved and grades the correct sequence", () => {
    const q = normaliseQuestion(raw({ type: "ordering", prompt: "Order mitosis", order: ["Prophase", "Metaphase", "Anaphase", "Telophase"] }))!;
    const p = q.payload as { items: string[] };
    const ans = (q.answer as { order: number[] }).order;
    expect(p.items).not.toEqual(["Prophase", "Metaphase", "Anaphase", "Telophase"]);
    expect(ans.map((i) => p.items[i])).toEqual(["Prophase", "Metaphase", "Anaphase", "Telophase"]);
    expect(gradeObjective("ordering", q.answer, ans)!.correct).toBe(true);
    expect(describeAnswer(q)).toContain("1. Prophase");
  });

  it("multi-select penalises wrong picks", () => {
    const q = normaliseQuestion(raw({ type: "multi_select", options: ["a", "b", "c", "d"], correct_indices: [0, 1] }))!;
    const c = (q.answer as { correct: number[] }).correct;
    expect(gradeObjective("multi_select", q.answer, c)).toEqual({ correct: true, score: 1 });
    const wrong = [0, 1, 2, 3].find((i) => !c.includes(i))!;
    expect(gradeObjective("multi_select", q.answer, [c[0], wrong])!.score).toBe(0);
  });
});
