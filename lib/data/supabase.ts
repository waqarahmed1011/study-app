import type { SupabaseClient } from "@supabase/supabase-js";
import type { Kit, TableName } from "@/lib/types";
import type { ListOptions, NewRow, Repo, Row } from "./repo";

const BUCKET = "sources";

// Supabase backend. Row-level security does the real scoping; we also add
// user_id filters so queries stay fast and explicit.
export function createSupabaseRepo(sb: SupabaseClient, userId: string): Repo {
  const fail = (op: string, error: { message: string } | null) => {
    if (error) throw new Error(`${op}: ${error.message}`);
  };

  const repo: Repo = {
    userId,
    async list<T extends TableName>(t: T, where?: Partial<Row<T>>, opts?: ListOptions<T>) {
      let q = sb.from(t).select("*").eq("user_id", userId);
      for (const [k, v] of Object.entries(where ?? {})) {
        q = v === null ? q.is(k, null) : q.eq(k, v as never);
      }
      if (opts?.orderBy) q = q.order(opts.orderBy, { ascending: opts.ascending ?? true });
      if (opts?.limit) q = q.limit(opts.limit);
      const { data, error } = await q;
      fail(`list ${t}`, error);
      return (data ?? []) as Row<T>[];
    },
    async get<T extends TableName>(t: T, id: string) {
      const { data, error } = await sb
        .from(t)
        .select("*")
        .eq("id", id)
        .eq("user_id", userId)
        .maybeSingle();
      fail(`get ${t}`, error);
      return (data as Row<T>) ?? null;
    },
    async insert<T extends TableName>(t: T, row: NewRow<T>) {
      const [r] = await repo.insertMany(t, [row]);
      return r;
    },
    async insertMany<T extends TableName>(t: T, rows: NewRow<T>[]) {
      if (rows.length === 0) return [];
      const { data, error } = await sb
        .from(t)
        .insert(rows.map((r) => ({ ...r, user_id: userId })))
        .select("*");
      fail(`insert ${t}`, error);
      return (data ?? []) as Row<T>[];
    },
    async update<T extends TableName>(t: T, id: string, patch: Partial<Row<T>>) {
      const rest: Record<string, unknown> = { ...patch };
      delete rest.id;
      delete rest.user_id;
      const { data, error } = await sb
        .from(t)
        .update(rest)
        .eq("id", id)
        .eq("user_id", userId)
        .select("*")
        .single();
      fail(`update ${t}`, error);
      return data as Row<T>;
    },
    async remove(t, id) {
      const { error } = await sb.from(t).delete().eq("id", id).eq("user_id", userId);
      fail(`delete ${t}`, error);
    },
    async removeWhere(t, where) {
      let q = sb.from(t).delete().eq("user_id", userId);
      for (const [k, v] of Object.entries(where)) q = q.eq(k, v as never);
      const { error } = await q;
      fail(`delete ${t}`, error);
    },
    async setKitStep(kitId, step, status, error) {
      const { data, error: err } = await sb.rpc("set_kit_step", { p_kit: kitId, p_step: step, p_status: status, p_error: error ?? null });
      fail("set_kit_step", err);
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) throw new Error(`kit ${kitId} not found`);
      return row as Kit;
    },
    async putFile(p, data, contentType) {
      const { error } = await sb.storage
        .from(BUCKET)
        .upload(`${userId}/${p}`, data, { contentType, upsert: true });
      fail("upload", error);
    },
    async getFile(p) {
      const { data, error } = await sb.storage.from(BUCKET).download(`${userId}/${p}`);
      fail("download", error);
      return {
        data: new Uint8Array(await data!.arrayBuffer()),
        contentType: data!.type || "application/octet-stream",
      };
    },
    async removeFile(p) {
      const { error } = await sb.storage.from(BUCKET).remove([`${userId}/${p}`]);
      fail("remove file", error);
    },
  };
  return repo;
}
