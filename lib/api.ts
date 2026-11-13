import "server-only";
import { NextResponse } from "next/server";
import { getRepo, UnauthorizedError, type Repo } from "@/lib/data";
import type { Question } from "@/lib/types";

/** Wrap a route handler: gives it the user's repo and turns errors into JSON. */
export function route<C>(fn: (req: Request, repo: Repo, ctx: C) => Promise<Response | unknown>) {
  return async (req: Request, ctx: C) => {
    try {
      const repo = await getRepo();
      const out = await fn(req, repo, ctx);
      return out instanceof Response ? out : NextResponse.json(out ?? { ok: true });
    } catch (err) {
      if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
      if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
      console.error(err);
      return NextResponse.json({ error: String((err as Error).message ?? err) }, { status: 500 });
    }
  };
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function must<T>(p: Promise<T | null>, what = "Not found"): Promise<T> {
  const v = await p;
  if (!v) throw new HttpError(404, what);
  return v;
}

/** The question as the student sees it before answering (no answer key). */
export function publicQuestion(q: Question) {
  return {
    id: q.id,
    type: q.type,
    prompt: q.prompt,
    payload: q.payload,
    difficulty: q.difficulty,
    topic_id: q.topic_id,
    origin: q.origin,
    verified: q.verified,
    rating: q.rating,
  };
}
export type PublicQuestion = ReturnType<typeof publicQuestion>;
