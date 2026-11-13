import "server-only";
import { connection } from "next/server";
import { useSupabase } from "@/lib/config";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createLocalRepo } from "./local";
import type { Repo } from "./repo";
import { createSupabaseRepo } from "./supabase";

export class UnauthorizedError extends Error {}

/** Repo for the current request's user. Throws UnauthorizedError if signed out. */
export async function getRepo(): Promise<Repo> {
  // per-user data: always read at request time, never prerendered
  await connection();
  if (!useSupabase) return createLocalRepo();
  const sb = await createSupabaseServer();
  // verified locally against the project's public signing key (no network call per request)
  const { data } = await sb.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) throw new UnauthorizedError("Not signed in");
  return createSupabaseRepo(sb, userId);
}

export type { Repo } from "./repo";
