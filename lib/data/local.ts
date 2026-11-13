import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";
import type { TableName } from "@/lib/types";
import { sortRows, type ListOptions, type NewRow, type Repo, type Row } from "./repo";

// JSON-file backend. One user ("local"). Good for trying the app with no
// accounts and for automated tests. Not for Vercel (read-only filesystem).

const DATA_DIR = process.env.LOCAL_DATA_DIR || path.join(process.cwd(), ".data");
const DB_FILE = path.join(DATA_DIR, "db.json");
const FILES_DIR = path.join(DATA_DIR, "files");

type DB = Record<string, Record<string, unknown>[]>;

// Read-modify-write with sync file calls so no other request can interleave
// inside one Node process. Pages and API routes run in separate module
// instances, so nothing may be cached in memory between calls.
function readDb(): DB {
  try {
    return JSON.parse(fsSync.readFileSync(DB_FILE, "utf8")) as DB;
  } catch {
    return {};
  }
}

function writeDb(db: DB) {
  fsSync.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${DB_FILE}.${process.pid}.tmp`;
  fsSync.writeFileSync(tmp, JSON.stringify(db));
  fsSync.renameSync(tmp, DB_FILE);
}

function mutate<T>(fn: (db: DB) => T): T {
  const db = readDb();
  const out = fn(db);
  writeDb(db);
  return out;
}

function matches(row: Record<string, unknown>, where?: Record<string, unknown>) {
  if (!where) return true;
  return Object.entries(where).every(([k, v]) => row[k] === v);
}

function safeFilePath(p: string) {
  const full = path.join(FILES_DIR, p);
  if (!full.startsWith(FILES_DIR + path.sep)) throw new Error("bad path");
  return full;
}

export function createLocalRepo(): Repo {
  const userId = "local";
  const rowsOf = (db: DB, t: string) => (db[t] ??= []);

  const repo: Repo = {
    userId,
    async list<T extends TableName>(t: T, where?: Partial<Row<T>>, opts?: ListOptions<T>) {
      const rows = rowsOf(readDb(), t).filter(
        (r) => r.user_id === userId && matches(r, where as Record<string, unknown>),
      ) as unknown as Row<T>[];
      const sorted = sortRows(rows, opts?.orderBy, opts?.ascending ?? true);
      return opts?.limit ? sorted.slice(0, opts.limit) : sorted;
    },
    async get<T extends TableName>(t: T, id: string) {
      const r = rowsOf(readDb(), t).find((x) => x.id === id && x.user_id === userId);
      return (r as unknown as Row<T>) ?? null;
    },
    async insert<T extends TableName>(t: T, row: NewRow<T>) {
      const [r] = await repo.insertMany(t, [row]);
      return r;
    },
    async insertMany<T extends TableName>(t: T, rows: NewRow<T>[]) {
      const now = new Date().toISOString();
      const out = rows.map((row) => ({ id: nanoid(), created_at: now, ...row, user_id: userId }));
      mutate((db) => rowsOf(db, t).push(...(out as Record<string, unknown>[])));
      return out as unknown as Row<T>[];
    },
    async update<T extends TableName>(t: T, id: string, patch: Partial<Row<T>>) {
      return mutate((db) => {
        const r = rowsOf(db, t).find((x) => x.id === id && x.user_id === userId);
        if (!r) throw new Error(`${t} ${id} not found`);
        Object.assign(r, patch, { id, user_id: userId });
        return structuredClone(r) as unknown as Row<T>;
      });
    },
    async remove(t, id) {
      mutate((db) => {
        db[t] = rowsOf(db, t).filter((x) => !(x.id === id && x.user_id === userId));
      });
    },
    async removeWhere(t, where) {
      mutate((db) => {
        db[t] = rowsOf(db, t).filter((x) => !(x.user_id === userId && matches(x, where as Record<string, unknown>)));
      });
    },
    async putFile(p, data, contentType) {
      const full = safeFilePath(p);
      await fs.mkdir(path.dirname(full), { recursive: true });
      await fs.writeFile(full, data);
      await fs.writeFile(full + ".type", contentType);
    },
    async getFile(p) {
      const full = safeFilePath(p);
      const data = new Uint8Array(await fs.readFile(full));
      const contentType = await fs.readFile(full + ".type", "utf8").catch(() => "application/octet-stream");
      return { data, contentType };
    },
    async removeFile(p) {
      const full = safeFilePath(p);
      await fs.rm(full, { force: true });
      await fs.rm(full + ".type", { force: true });
    },
  };
  return repo;
}
