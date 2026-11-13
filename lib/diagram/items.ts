import type { Box, DiagramGenKind, DiagramRegion, ImageRef, Question } from "@/lib/types";
import { labelMatches } from "./geometry";

// Turns a confirmed diagram into study items (pure, so it's unit tested).
// Every picture covers all printed labels/numbers so it never shows the answer.

export interface CardSpec {
  region_id: string;
  gen_kind: Extract<DiagramGenKind, "img_to_name" | "name_to_img" | "fact">;
  front: string;
  back: string;
  front_image: ImageRef | null;
  back_image: ImageRef | null;
  /** for fact cards: the fact question this came from */
  source_question_id?: string;
}

export interface QuestionSpec {
  region_id: string;
  gen_kind: Extract<DiagramGenKind, "identify" | "which_image">;
  prompt: string;
  options: string[];
  optionImages?: ImageRef[];
  correct: number;
  image: ImageRef | null;
  explanation: string;
}

type Rand = () => number;

function pickOthers<T>(items: T[], exclude: T, n: number, rand: Rand) {
  const pool = items.filter((x) => x !== exclude);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
}

function shuffleWithAnswer<T>(answer: T, others: T[], rand: Rand) {
  const all = [answer, ...others];
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return { items: all, correct: all.indexOf(answer) };
}

/** Which region a fact question is about: the region whose label appears in it. */
export function regionForText(regions: DiagramRegion[], text: string) {
  const lower = text.toLowerCase();
  return (
    [...regions].sort((a, b) => b.label.length - a.label.length).find((r) => lower.includes(r.label.toLowerCase())) ??
    regions.find((r) => text.split(/[^a-zA-Z0-9]+/).some((w) => w.length > 3 && labelMatches(w, r.label))) ??
    null
  );
}

export function buildDiagramItems(opts: {
  path: string;
  title: string;
  regions: DiagramRegion[];
  verifiedFacts: Pick<Question, "id" | "prompt" | "type" | "answer" | "payload">[];
  describe: (q: Pick<Question, "type" | "answer" | "payload">) => string;
  rand?: Rand;
}): { cards: CardSpec[]; questions: QuestionSpec[] } {
  const rand = opts.rand ?? Math.random;
  const regions = opts.regions.filter((r) => r.confirmed && r.label.trim());
  const covers: Box[] = opts.regions.map((r) => r.labelBox).filter((b): b is Box => Boolean(b));
  // "both, randomly": each picture is a zoomed crop or the whole diagram
  const img = (r: DiagramRegion, zoom = rand() < 0.5): ImageRef => ({ path: opts.path, highlight: r.box, covers, zoom });

  const cards: CardSpec[] = [];
  const questions: QuestionSpec[] = [];

  for (const r of regions) {
    // picture as the term, name as the definition
    cards.push({ region_id: r.id, gen_kind: "img_to_name", front: "Name the highlighted structure", back: r.label, front_image: img(r), back_image: null });
    // name as the term, picture as the definition
    cards.push({ region_id: r.id, gen_kind: "name_to_img", front: `Where is the ${r.label}?`, back: r.label, front_image: null, back_image: img(r, false) });

    if (regions.length >= 2) {
      const others = pickOthers(regions, r, 3, rand);
      const names = shuffleWithAnswer(r.label, others.map((o) => o.label), rand);
      questions.push({
        region_id: r.id,
        gen_kind: "identify",
        prompt: "What is the highlighted structure?",
        options: names.items,
        correct: names.correct,
        image: img(r),
        explanation: `The highlighted structure is the **${r.label}** (from your diagram "${opts.title}").`,
      });
      const pics = shuffleWithAnswer(r, others, rand);
      questions.push({
        region_id: r.id,
        gen_kind: "which_image",
        prompt: `Which picture highlights the **${r.label}**?`,
        options: pics.items.map((_, i) => `Picture ${String.fromCharCode(65 + i)}`),
        optionImages: pics.items.map((x) => img(x, false)),
        correct: pics.correct,
        image: null,
        explanation: `Picture ${String.fromCharCode(65 + pics.correct)} shows the ${r.label}.`,
      });
    }
  }

  // fact cards only from facts the student has checked
  for (const q of opts.verifiedFacts) {
    const r = regionForText(regions, q.prompt);
    const front = r ? q.prompt.replace(new RegExp(r.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig"), "highlighted structure") : q.prompt;
    cards.push({
      // keyed by the fact question so each fact keeps its own review history
      region_id: `q:${q.id}`,
      gen_kind: "fact",
      front,
      back: opts.describe(q),
      front_image: r ? img(r) : { path: opts.path, highlight: null, covers, zoom: false },
      back_image: null,
      source_question_id: q.id,
    });
  }
  return { cards, questions };
}
