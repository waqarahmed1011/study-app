import "server-only";
import type { Repo } from "@/lib/data/repo";
import { box2dToBox } from "@/lib/diagram/geometry";
import { newFsrsState } from "@/lib/study/fsrs";
import { normaliseQuestion } from "@/lib/study/questions";
import type { Diagram, DiagramRegion, GenStep, Kit, Source, Topic } from "@/lib/types";
import { nanoid } from "nanoid";
import * as P from "./prompts";
import { getAI } from "./provider";
import { DiagramDetectSchema, FlashcardsSchema, OutlineSchema, QuestionsSchema, type RawQuestion } from "./schemas";

export function materialOf(sources: Source[]) {
  return sources
    .filter((s) => s.status === "done" && s.extracted_md)
    .map((s) => `## Source: ${s.name}\n\n${s.extracted_md}`)
    .join("\n\n---\n\n");
}

async function setStep(repo: Repo, kit: Kit, step: GenStep, status: "running" | "done" | "error", error?: string) {
  return repo.setKitStep(kit.id, step, status, error);
}

/** Map a topic name from the model back to a topic id (case-insensitive, falls back to the first topic). */
function topicResolver(topics: Topic[]) {
  const byName = new Map(topics.map((t) => [t.name.toLowerCase().trim(), t.id]));
  return (name: string) => byName.get(name?.toLowerCase().trim()) ?? topics.find((t) => name && t.name.toLowerCase().includes(name.toLowerCase()))?.id ?? topics[0]?.id ?? null;
}

function questionTarget(material: string) {
  const words = material.split(/\s+/).length;
  return Math.max(12, Math.min(40, Math.round(words / 80)));
}

export async function extractSource(repo: Repo, source: Source) {
  const ai = await getAI();
  if (source.kind === "text") {
    return repo.update("sources", source.id, { status: "done", error: null });
  }
  try {
    const file = await repo.getFile(source.storage_path!);
    // a diagram's text and its labels are read at the same time
    const [md] = await Promise.all([
      ai.text({
        task: "extract",
        system: P.SYSTEM_TUTOR,
        prompt: P.extractPrompt(source.kind),
        files: [{ mimeType: source.mime || file.contentType, data: file.data }],
      }),
      source.kind === "diagram" ? detectDiagram(repo, source, file) : null,
    ]);
    return repo.update("sources", source.id, { extracted_md: md.trim(), status: "done", error: null });
  } catch (err) {
    return repo.update("sources", source.id, { status: "error", error: String((err as Error).message).slice(0, 500) });
  }
}

export async function detectDiagram(repo: Repo, source: Source, file?: { data: Uint8Array; contentType: string }) {
  const ai = await getAI();
  const f = file ?? (await repo.getFile(source.storage_path!));
  const res = await ai.json({
    task: "diagram_detect",
    schema: DiagramDetectSchema,
    // thinking matters here: without it numbered labels get misread
    prompt: P.diagramDetectPrompt,
    files: [{ mimeType: source.mime || f.contentType, data: f.data }],
  });
  const regions: DiagramRegion[] = res.structures
    .map((s) => ({ s, box: box2dToBox(s.box_2d) ?? box2dToBox(s.label_box_2d) }))
    .filter((x) => x.box && x.s.label.trim())
    .map(({ s, box }) => ({
      id: nanoid(8),
      label: s.label.trim(),
      marker: s.marker?.trim() || undefined,
      box: box!,
      labelBox: box2dToBox(s.label_box_2d),
      confirmed: false,
      seen: 0,
      correct: 0,
    }));
  const existing = (await repo.list("diagrams", { source_id: source.id }))[0];
  if (existing) return repo.update("diagrams", existing.id, { regions, status: "draft" });
  const title = res.title?.trim() || source.name.replace(/\.[a-z0-9]+$/i, "");
  const topic = await repo.insert("topics", {
    kit_id: source.kit_id,
    name: `Diagram: ${title}`.slice(0, 80),
    description: "Labelled structures from your diagram",
    mastery: 0,
    attempts: 0,
    correct: 0,
  });
  return repo.insert("diagrams", {
    kit_id: source.kit_id,
    source_id: source.id,
    topic_id: topic.id,
    title,
    regions,
    status: "draft",
  } satisfies Omit<Diagram, "id" | "user_id" | "created_at">);
}

/** Run one generation step for a kit. The client calls these in order and shows progress. */
export async function runStep(repo: Repo, kitId: string, step: GenStep) {
  const ai = await getAI();
  let kit = (await repo.get("kits", kitId))!;
  if (!kit) throw new Error("Kit not found");
  kit = await setStep(repo, kit, step, "running");

  try {
    const sources = await repo.list("sources", { kit_id: kitId }, { orderBy: "created_at" });
    const topics = () => repo.list("topics", { kit_id: kitId }, { orderBy: "created_at" });
    const fresh = sources.filter((s) => !s.generated);
    const allMaterial = materialOf(sources);
    const newMaterial = materialOf(fresh) || allMaterial;

    switch (step) {
      case "extract": {
        // read up to 3 uploads at once (the free tier allows a handful of parallel requests)
        const pending = sources.filter((s) => s.status === "pending");
        for (let i = 0; i < pending.length; i += 3) await Promise.all(pending.slice(i, i + 3).map((s) => extractSource(repo, s)));
        const after = await repo.list("sources", { kit_id: kitId });
        if (!after.some((s) => s.status === "done")) {
          const errs = after.map((s) => s.error).filter(Boolean).join("; ");
          throw new Error(errs || "None of the uploads could be read.");
        }
        break;
      }
      case "outline": {
        const existing = (await topics()).filter((t) => !t.name.startsWith("Diagram: "));
        const out = await ai.json({
          task: "outline",
          // Lite: splitting notes into topics is simple, and every later step waits
          // on it (7s -> 1s); in testing it chose the same topics as the full model
          lite: true,
          schema: OutlineSchema,
          system: P.SYSTEM_TUTOR,
          prompt: P.outlinePrompt(newMaterial, existing.map((t) => t.name), kit.title === "Untitled kit" ? "" : kit.title),
        });
        const have = new Set(existing.map((t) => t.name.toLowerCase()));
        const toAdd = out.topics.filter((t) => !have.has(t.name.toLowerCase().trim()));
        await repo.insertMany(
          "topics",
          toAdd.map((t) => ({ kit_id: kitId, name: t.name.trim().slice(0, 80), description: t.description, mastery: 0, attempts: 0, correct: 0 })),
        );
        if (kit.title === "Untitled kit" || !existing.length) {
          await repo.update("kits", kitId, {
            title: kit.title === "Untitled kit" ? out.title.slice(0, 80) : kit.title,
            emoji: out.emoji?.trim().slice(0, 4) || kit.emoji,
          });
        }
        break;
      }
      case "flashcards": {
        // nothing new to make cards from (e.g. "Update kit" with no new uploads)
        if (!fresh.length && (await repo.list("flashcards", { kit_id: kitId }, { limit: 1 })).length) break;
        const ts = (await topics()).filter((t) => !t.name.startsWith("Diagram: "));
        const res = await ai.json({ task: "flashcards", schema: FlashcardsSchema, system: P.SYSTEM_TUTOR, prompt: P.flashcardsPrompt(newMaterial, ts.map((t) => t.name)) });
        const resolve = topicResolver(ts);
        const now = new Date();
        await repo.insertMany(
          "flashcards",
          res.cards
            .filter((c) => c.front.trim() && c.back.trim())
            .map((c, i) => ({
              kit_id: kitId, topic_id: resolve(c.topic), front: c.front.trim(), back: c.back.trim(), fsrs: newFsrsState(now),
              front_image: null, back_image: null, position: Date.now() + i, diagram_id: null, region_id: null, gen_kind: null,
            })),
        );
        break;
      }
      case "questions": {
        if (!fresh.length && (await repo.list("questions", { kit_id: kitId }, { limit: 1 })).length) break;
        const ts = (await topics()).filter((t) => !t.name.startsWith("Diagram: "));
        await generateQuestions(repo, kitId, newMaterial, ts, questionTarget(newMaterial));
        for (const s of fresh) await repo.update("sources", s.id, { generated: true });
        break;
      }
      case "guide":
      case "summary": {
        const ts = (await topics()).map((t) => t.name);
        const md = await ai.text({
          task: step,
          system: P.SYSTEM_TUTOR,
          prompt: step === "guide" ? P.guidePrompt(allMaterial, ts) : P.summaryPrompt(allMaterial, ts),
        });
        await repo.removeWhere("documents", { kit_id: kitId, kind: step });
        await repo.insert("documents", { kit_id: kitId, kind: step, content_md: md.trim() });
        break;
      }
    }
    return setStep(repo, kit, step, "done");
  } catch (err) {
    const msg = String((err as Error).message ?? err).slice(0, 500);
    await setStep(repo, kit, step, "error", msg);
    throw err;
  }
}

export async function generateQuestions(repo: Repo, kitId: string, material: string, topics: Topic[], count: number, focus?: string) {
  const ai = await getAI();
  if (!topics.length) throw new Error("This kit has no topics yet.");
  // One long reply is the slowest part of building a kit (~18s for 12 questions).
  // Split the topics into up to 4 batches and write them side by side instead.
  const batchCount = Math.max(1, Math.min(4, topics.length, Math.ceil(count / 5)));
  const batches = Array.from({ length: batchCount }, (_, i) => topics.filter((_, t) => t % batchCount === i));
  const settled = await Promise.allSettled(
    batches.map((batch) =>
      ai.json({
        task: focus ? "more_questions" : "questions",
        schema: QuestionsSchema,
        system: P.SYSTEM_TUTOR,
        prompt: P.questionsPrompt(material, batch.map((t) => t.name), Math.max(3, Math.round((count * batch.length) / topics.length)), focus),
      }),
    ),
  );
  const ok = settled.filter((r): r is PromiseFulfilledResult<{ questions: RawQuestion[] }> => r.status === "fulfilled");
  if (!ok.length) throw (settled[0] as PromiseRejectedResult).reason;
  const resolve = topicResolver(topics);
  const rows = ok
    .flatMap((r) => r.value.questions)
    .map(normaliseQuestion)
    .filter((q): q is NonNullable<typeof q> => q !== null)
    .map((q) => ({
      kit_id: kitId,
      topic_id: resolve(q.topic),
      type: q.type,
      prompt: q.prompt,
      payload: q.payload,
      answer: q.answer,
      explanation: q.explanation,
      difficulty: q.difficulty,
      origin: "kit" as const,
      diagram_id: null,
      image: null,
      region_id: null,
      gen_kind: null,
      verified: true,
      rating: 0,
    }));
  return repo.insertMany("questions", rows);
}

/** Top up the question bank, aimed at the weakest topics. Used by Smart Study and tests. */
export async function generateMoreQuestions(repo: Repo, kitId: string, count = 12) {
  const sources = await repo.list("sources", { kit_id: kitId });
  const topics = (await repo.list("topics", { kit_id: kitId })).filter((t) => !t.name.startsWith("Diagram: "));
  const weakest = [...topics].sort((a, b) => a.mastery - b.mastery).slice(0, 3);
  const existing = await repo.list("questions", { kit_id: kitId });
  const avoid = existing.slice(-40).map((q) => q.prompt.slice(0, 100));
  const focus = `${weakest.map((t) => t.name).join(", ")}. Write NEW questions, different from these existing ones: ${JSON.stringify(avoid)}`;
  return generateQuestions(repo, kitId, materialOf(sources), topics, count, focus);
}
