import { route } from "@/lib/api";
import type { TableName } from "@/lib/types";

const TABLES: TableName[] = ["kits", "sources", "topics", "flashcards", "questions", "attempts", "tests", "documents", "chat_messages", "diagrams"];

// GET: export everything as JSON. DELETE: wipe all of this user's study data.
export const GET = route(async (_req, repo) => {
  const out: Record<string, unknown[]> = {};
  for (const t of TABLES) out[t] = await repo.list(t);
  return new Response(JSON.stringify({ exported_at: new Date().toISOString(), ...out }, null, 2), {
    headers: { "content-type": "application/json", "content-disposition": 'attachment; filename="study-ai-export.json"' },
  });
});

export const DELETE = route(async (_req, repo) => {
  for (const s of await repo.list("sources")) if (s.storage_path) await repo.removeFile(s.storage_path).catch(() => {});
  for (const t of ["attempts", "questions", "flashcards", "diagrams", "tests", "documents", "chat_messages", "topics", "sources", "kits"] as TableName[]) {
    await repo.removeWhere(t, {});
  }
  return { ok: true };
});
