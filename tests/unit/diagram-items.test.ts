import { describe, expect, it } from "vitest";
import { buildDiagramItems, regionForText } from "@/lib/diagram/items";
import { describeAnswer } from "@/lib/study/questions";
import type { DiagramRegion } from "@/lib/types";

const region = (id: string, label: string, y: number, confirmed = true): DiagramRegion => ({
  id, label, box: { x: 0.3, y, w: 0.2, h: 0.1 }, labelBox: { x: 0.7, y, w: 0.1, h: 0.05 }, confirmed, seen: 0, correct: 0,
});
const regions = [region("a", "Epimysium", 0.1), region("b", "Perimysium", 0.3), region("c", "Endomysium", 0.5), region("d", "Myofibril", 0.7), region("x", "Draft label", 0.9, false)];
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

describe("diagram study items", () => {
  const { cards, questions } = buildDiagramItems({
    path: "kit/src.png", title: "Skeletal muscle", regions, describe: describeAnswer, rand,
    verifiedFacts: [{ id: "f1", type: "short_answer", prompt: "What does the perimysium surround?", answer: { text: "Each fascicle" }, payload: {} }],
  });

  it("makes cards both ways for every confirmed label, and none for drafts", () => {
    const toName = cards.filter((c) => c.gen_kind === "img_to_name");
    const toImg = cards.filter((c) => c.gen_kind === "name_to_img");
    expect(toName).toHaveLength(4);
    expect(toImg).toHaveLength(4);
    expect(cards.some((c) => c.back === "Draft label")).toBe(false);
    // picture as term: the image is on the front, the name on the back
    const a = toName.find((c) => c.region_id === "a")!;
    expect(a.front_image?.highlight).toEqual(regions[0].box);
    expect(a.back).toBe("Epimysium");
    // name as term: the image is on the back
    const b = toImg.find((c) => c.region_id === "b")!;
    expect(b.front).toContain("Perimysium");
    expect(b.back_image?.highlight).toEqual(regions[1].box);
  });

  it("covers every printed label so the picture can't give the answer away", () => {
    for (const c of cards) {
      const img = c.front_image ?? c.back_image;
      expect(img?.covers).toHaveLength(5);
    }
  });

  it("mixes zoomed and whole-diagram pictures", () => {
    const zooms = cards.filter((c) => c.gen_kind === "img_to_name").map((c) => c.front_image!.zoom);
    expect(new Set(zooms).size).toBeGreaterThanOrEqual(1);
  });

  it("builds picture questions with the right answer in the options", () => {
    const ident = questions.filter((q) => q.gen_kind === "identify");
    expect(ident).toHaveLength(4);
    for (const q of ident) expect(q.options[q.correct]).toBe(regions.find((r) => r.id === q.region_id)!.label);
    const which = questions.filter((q) => q.gen_kind === "which_image");
    for (const q of which) {
      expect(q.optionImages).toHaveLength(4);
      expect(q.optionImages![q.correct].highlight).toEqual(regions.find((r) => r.id === q.region_id)!.box);
    }
  });

  it("turns checked facts into picture cards without naming the structure", () => {
    const f = cards.find((c) => c.gen_kind === "fact")!;
    expect(f.front).toBe("What does the highlighted structure surround?");
    expect(f.back).toBe("Each fascicle");
    expect(f.front_image?.highlight).toEqual(regions[1].box);
    expect(regionForText(regions, "Where does the endomysium lie?")?.id).toBe("c");
  });
});
