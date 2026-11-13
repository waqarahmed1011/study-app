import { HttpError, must, route } from "@/lib/api";
import type { IdCtx } from "@/lib/route-types";
import type { SourceKind } from "@/lib/types";

const MAX_BYTES = 20 * 1024 * 1024; // Gemini inline limit is ~20MB per request

function kindFor(mime: string, wantDiagram: boolean): SourceKind {
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("image/")) return wantDiagram ? "diagram" : "image";
  if (mime.startsWith("text/") || mime === "application/json") return "text";
  throw new HttpError(415, `Unsupported file type: ${mime || "unknown"}. Use PDF, images or plain text.`);
}

// Accepts either JSON {name, text} (pasted notes) or multipart form (file + diagram flag).
export const POST = route<IdCtx>(async (req, repo, { params }) => {
  const { id } = await params;
  const kit = await must(repo.get("kits", id), "Kit not found");
  const now = new Date().toISOString();

  if ((req.headers.get("content-type") ?? "").includes("application/json")) {
    const { name, text, uploaded, diagram } = (await req.json()) as {
      name?: string;
      text?: string;
      diagram?: boolean;
      // set when the browser uploaded straight to Supabase Storage (avoids Vercel's 4.5MB body limit)
      uploaded?: { path: string; mime: string; size: number };
    };
    if (uploaded) {
      if (!uploaded.path.startsWith(`${kit.id}/`) || uploaded.path.includes("..")) throw new HttpError(400, "Bad upload path");
      if (uploaded.size > MAX_BYTES) throw new HttpError(413, "That file is over 20 MB.");
      return repo.insert("sources", {
        kit_id: kit.id, kind: kindFor(uploaded.mime, Boolean(diagram)), name: name || "upload", storage_path: uploaded.path,
        mime: uploaded.mime, extracted_md: null, status: "pending", error: null, generated: false,
      });
    }
    if (!text?.trim()) throw new HttpError(400, "Paste some text first.");
    const src = await repo.insert("sources", {
      kit_id: kit.id, kind: "text", name: name?.trim() || "Pasted notes", storage_path: null, mime: "text/plain",
      extracted_md: text.trim(), status: "done", error: null, generated: false,
    });
    await repo.update("kits", kit.id, { updated_at: now });
    return src;
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "No file uploaded.");
  if (file.size > MAX_BYTES) throw new HttpError(413, "That file is over 20 MB. Split the PDF or compress it.");
  const kind = kindFor(file.type, form.get("diagram") === "1");
  const bytes = new Uint8Array(await file.arrayBuffer());

  if (kind === "text") {
    return repo.insert("sources", {
      kit_id: kit.id, kind, name: file.name, storage_path: null, mime: file.type,
      extracted_md: new TextDecoder().decode(bytes), status: "done", error: null, generated: false,
    });
  }
  const src = await repo.insert("sources", {
    kit_id: kit.id, kind, name: file.name || "upload", storage_path: null, mime: file.type,
    extracted_md: null, status: "pending", error: null, generated: false,
  });
  const ext = (file.name.split(".").pop() || "bin").replace(/[^a-z0-9]/gi, "").slice(0, 5).toLowerCase();
  const path = `${kit.id}/${src.id}.${ext}`;
  await repo.putFile(path, bytes, file.type);
  return repo.update("sources", src.id, { storage_path: path });
});
