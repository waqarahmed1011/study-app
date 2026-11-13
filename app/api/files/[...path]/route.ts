import { route } from "@/lib/api";

// Serves the signed-in user's uploaded files (images for diagrams, originals).
export const GET = route<{ params: Promise<{ path: string[] }> }>(async (_req, repo, { params }) => {
  const { path } = await params;
  const file = await repo.getFile(path.join("/"));
  return new Response(Buffer.from(file.data), {
    headers: { "content-type": file.contentType, "cache-control": "private, max-age=3600" },
  });
});
