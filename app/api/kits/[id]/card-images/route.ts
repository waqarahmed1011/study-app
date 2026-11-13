import { nanoid } from "nanoid";
import { HttpError, must, route } from "@/lib/api";
import type { IdCtx } from "@/lib/route-types";

// Upload a picture for a card side. The browser shrinks it first.
export const POST = route<IdCtx>(async (req, repo, { params }) => {
  const { id } = await params;
  await must(repo.get("kits", id), "Kit not found");
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || !file.type.startsWith("image/")) throw new HttpError(400, "Choose an image file.");
  if (file.size > 4 * 1024 * 1024) throw new HttpError(413, "That image is too large (max 4 MB).");
  const ext = (file.name.split(".").pop() || "jpg").replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 5);
  const path = `${id}/cards/${nanoid()}.${ext}`;
  await repo.putFile(path, new Uint8Array(await file.arrayBuffer()), file.type);
  return { path, highlight: null, covers: [], zoom: false };
});
