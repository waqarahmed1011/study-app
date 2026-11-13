import { must, route } from "@/lib/api";
import { materialOf } from "@/lib/ai/pipeline";
import { tutorSystem } from "@/lib/ai/prompts";
import { getAI } from "@/lib/ai/provider";
import type { IdCtx } from "@/lib/route-types";

export const maxDuration = 120;

// Streams the tutor's reply as plain text, then saves both messages.
export const POST = route<IdCtx>(async (req, repo, { params }) => {
  const { id } = await params;
  await must(repo.get("kits", id), "Kit not found");
  const { message } = (await req.json()) as { message: string };
  const text = message?.trim().slice(0, 4000);
  if (!text) return { error: "Empty message" };

  const sources = await repo.list("sources", { kit_id: id }, { orderBy: "created_at" });
  const history = (await repo.list("chat_messages", { kit_id: id }, { orderBy: "created_at" })).slice(-20);
  await repo.insert("chat_messages", { kit_id: id, role: "user", content: text });

  const ai = await getAI();
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let full = "";
      try {
        for await (const chunk of ai.stream({
          task: "chat",
          system: tutorSystem(materialOf(sources), sources.map((s) => s.name)),
          messages: [...history.map((m) => ({ role: m.role, content: m.content })), { role: "user" as const, content: text }],
        })) {
          full += chunk;
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (err) {
        const msg = `\n\n_(The tutor hit an error: ${String((err as Error).message).slice(0, 200)})_`;
        full += msg;
        controller.enqueue(encoder.encode(msg));
      }
      if (full.trim()) await repo.insert("chat_messages", { kit_id: id, role: "assistant", content: full });
      controller.close();
    },
  });
  return new Response(stream, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
});

export const DELETE = route<IdCtx>(async (_req, repo, { params }) => {
  const { id } = await params;
  await repo.removeWhere("chat_messages", { kit_id: id });
  return { ok: true };
});
