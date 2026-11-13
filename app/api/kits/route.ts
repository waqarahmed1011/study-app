import { route } from "@/lib/api";

export const POST = route(async (req, repo) => {
  const body = (await req.json().catch(() => ({}))) as { title?: string };
  const now = new Date().toISOString();
  return repo.insert("kits", {
    title: body.title?.trim().slice(0, 80) || "Untitled kit",
    emoji: "📘",
    status: "draft",
    gen_steps: {},
    gen_error: null,
    updated_at: now,
  });
});
