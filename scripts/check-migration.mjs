// Applies the Supabase migration to an in-memory Postgres (PGlite) with stub
// auth/storage schemas, then checks RLS keeps users apart. No Docker needed.
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";

const db = new PGlite();
await db.exec(`
  create role authenticated; create role anon;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean);
  create table storage.objects (id serial primary key, bucket_id text, name text);
  create function storage.foldername(name text) returns text[] language sql as $$ select string_to_array(name, '/') $$;
`);
let sql = fs.readFileSync(new URL("../supabase/migrations/0001_init.sql", import.meta.url), "utf8");
// PGlite ships without pgcrypto; gen_random_uuid() is built into Postgres 13+
sql = sql.replace("create extension if not exists pgcrypto;", "");
try {
  await db.exec(sql);
} catch (e) {
  console.error("Migration failed:", e.message, "at position", e.position);
  process.exit(1);
}
await db.exec(`alter table storage.objects enable row level security;`);

const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";
await db.exec(`insert into auth.users values ('${A}'), ('${B}');
  grant usage on schema public, auth, storage to authenticated;
  grant all on all tables in schema public to authenticated;
  grant execute on all functions in schema auth to authenticated;`);

async function as(user, q) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${user}', false);`);
  try {
    return await db.query(q);
  } finally {
    await db.exec(`reset role;`);
  }
}

await as(A, `insert into public.kits (title) values ('A kit')`);
const mine = await as(A, `select title, user_id from public.kits`);
const theirs = await as(B, `select title from public.kits`);
let blocked = false;
try {
  await as(B, `insert into public.kits (title, user_id) values ('sneaky', '${A}')`);
} catch {
  blocked = true;
}
const tables = await db.query(`select tablename from pg_tables where schemaname='public' order by 1`);
console.log("tables:", tables.rows.map((r) => r.tablename).join(", "));
console.log("A sees", mine.rows.length, "kit(s), owned by", mine.rows[0]?.user_id === A ? "A" : "??");
console.log("B sees", theirs.rows.length, "kit(s)");
console.log("B inserting as A blocked:", blocked);
if (mine.rows.length !== 1 || theirs.rows.length !== 0 || !blocked) process.exit(1);
console.log("RLS OK");
