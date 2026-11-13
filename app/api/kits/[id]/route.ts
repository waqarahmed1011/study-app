import { must, route } from "@/lib/api";
import type { IdCtx } from "@/lib/route-types";

export const GET = route<IdCtx>(async (_req, repo, { params }) => {
  const { id } = await params;
  const kit = await must(repo.get("kits", id));
  const sources = await repo.list("sources", { kit_id: id }, { orderBy: "created_at" });
  return { kit, sources: sources.map(({ extracted_md, ...s }) => ({ ...s, chars: extracted_md?.length ?? 0 })) };
});

export const PATCH = route<IdCtx>(async (req, repo, { params }) => {
  const { id } = await params;
  await must(repo.get("kits", id));
  const body = (await req.json()) as { title?: string; emoji?: string };
  return repo.update("kits", id, {
    ...(body.title ? { title: body.title.trim().slice(0, 80) } : {}),
    ...(body.emoji ? { emoji: body.emoji.slice(0, 4) } : {}),
    updated_at: new Date().toISOString(),
  });
});

export const DELETE = route<IdCtx>(async (_req, repo, { params }) => {
  const { id } = await params;
  const sources = await repo.list("sources", { kit_id: id });
  for (const s of sources) if (s.storage_path) await repo.removeFile(s.storage_path).catch(() => {});
  // Supabase cascades; the local store needs explicit cleanup
  for (const t of ["attempts", "questions", "flashcards", "diagrams", "tests", "documents", "chat_messages", "topics", "sources"] as const) {
    await repo.removeWhere(t, { kit_id: id });
  }
  await repo.remove("kits", id);
  return { ok: true };
});
