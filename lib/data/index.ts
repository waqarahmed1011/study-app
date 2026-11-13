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
  const { data } = await sb.auth.getUser();
  if (!data.user) throw new UnauthorizedError("Not signed in");
  return createSupabaseRepo(sb, data.user.id);
}

export type { Repo } from "./repo";
