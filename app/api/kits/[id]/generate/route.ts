import { HttpError, must, route } from "@/lib/api";
import { runStep } from "@/lib/ai/pipeline";
import type { IdCtx } from "@/lib/route-types";
import { GEN_STEPS, type GenStep } from "@/lib/types";

export const maxDuration = 300; // long PDFs on the free tier can take a while

// Runs one step of kit generation. The client walks through the steps in order.
export const POST = route<IdCtx>(async (req, repo, { params }) => {
  const { id } = await params;
  await must(repo.get("kits", id), "Kit not found");
  const { step } = (await req.json()) as { step: GenStep };
  if (!GEN_STEPS.includes(step)) throw new HttpError(400, "Unknown step");
  const kit = await runStep(repo, id, step);
  return { kit };
});
