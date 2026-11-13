import "server-only";
import type { Repo } from "@/lib/data/repo";
import { newFsrsState } from "@/lib/study/fsrs";
import { describeAnswer } from "@/lib/study/questions";
import type { Diagram } from "@/lib/types";
import { buildDiagramItems, regionForText } from "./items";

/**
 * Bring a diagram's generated flashcards and questions in line with its
 * confirmed labels. Items are matched by (region, kind), so editing a label
 * updates the card in place and keeps its review history; items for removed
 * labels are deleted.
 */
export async function syncDiagramItems(repo: Repo, d: Diagram) {
  const source = await repo.get("sources", d.source_id);
  if (!source?.storage_path) return { cards: 0, questions: 0 };

  const diagramQuestions = await repo.list("questions", { diagram_id: d.id });
  const verifiedFacts = diagramQuestions.filter((q) => q.gen_kind === "fact" || (!q.gen_kind && q.origin === "diagram")).filter((q) => q.verified);
  const confirmed = d.regions.filter((r) => r.confirmed);

  const { cards, questions } = buildDiagramItems({
    path: source.storage_path,
    title: d.title,
    regions: d.regions,
    verifiedFacts,
    describe: describeAnswer,
  });

  // --- flashcards
  const existingCards = await repo.list("flashcards", { diagram_id: d.id });
  const cardKey = (k: { gen_kind: string | null; region_id: string | null }) => `${k.gen_kind}|${k.region_id}`;
  const byKey = new Map(existingCards.map((c) => [cardKey(c), c]));
  const keep = new Set<string>();
  let pos = Date.now();
  for (const c of cards) {
    const key = cardKey(c);
    keep.add(key);
    const fields = { front: c.front, back: c.back, front_image: c.front_image, back_image: c.back_image };
    const old = byKey.get(key);
    if (old) {
      // keep the student's own edits to the text; refresh the pictures
      await repo.update("flashcards", old.id, { front_image: c.front_image, back_image: c.back_image });
    } else {
      await repo.insert("flashcards", {
        kit_id: d.kit_id, topic_id: d.topic_id, ...fields, fsrs: newFsrsState(), position: pos++,
        diagram_id: d.id, region_id: c.region_id, gen_kind: c.gen_kind,
      });
    }
  }
  for (const c of existingCards) if (c.gen_kind && !keep.has(cardKey(c))) await repo.remove("flashcards", c.id);

  // --- picture questions for Smart Study and tests
  const autoQs = diagramQuestions.filter((q) => q.gen_kind === "identify" || q.gen_kind === "which_image");
  const qByKey = new Map(autoQs.map((q) => [cardKey(q), q]));
  const keepQ = new Set<string>();
  for (const q of questions) {
    const key = cardKey(q);
    keepQ.add(key);
    const fields = {
      prompt: q.prompt,
      payload: q.optionImages ? { options: q.options, optionImages: q.optionImages } : { options: q.options },
      answer: { correct: [q.correct] },
      explanation: q.explanation,
      image: q.image,
    };
    const old = qByKey.get(key);
    if (old) await repo.update("questions", old.id, fields);
    else
      await repo.insert("questions", {
        kit_id: d.kit_id, topic_id: d.topic_id, type: "mcq", ...fields, difficulty: q.gen_kind === "which_image" ? 2 : 1,
        origin: "diagram", diagram_id: d.id, region_id: q.region_id, gen_kind: q.gen_kind, verified: true, rating: 0,
      });
  }
  for (const q of autoQs) if (!keepQ.has(cardKey(q))) await repo.remove("questions", q.id);

  // verified fact questions get the picture too, so Smart Study shows what they're about
  for (const q of verifiedFacts) {
    const r = regionForText(confirmed, q.prompt);
    const covers = d.regions.map((x) => x.labelBox).filter((b) => b !== null);
    await repo.update("questions", q.id, {
      image: { path: source.storage_path, highlight: r?.box ?? null, covers, zoom: false },
      region_id: r?.id ?? null,
      gen_kind: "fact",
    });
  }

  return { cards: cards.length, questions: questions.length };
}
