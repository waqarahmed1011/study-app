import type { TableMap, TableName } from "@/lib/types";

export type Row<T extends TableName> = TableMap[T];
export type NewRow<T extends TableName> = Omit<
  Row<T>,
  "id" | "user_id" | "created_at"
> &
  Partial<Pick<Row<T>, "id" | "created_at">>;

export interface ListOptions<T extends TableName> {
  orderBy?: keyof Row<T> & string;
  ascending?: boolean;
  limit?: number;
}

/**
 * A tiny table store. Every call is scoped to the signed-in user.
 * Implemented by the Supabase backend (production) and a JSON-file backend
 * (zero-setup local use and tests).
 */
export interface Repo {
  userId: string;
  list<T extends TableName>(
    table: T,
    where?: Partial<Row<T>>,
    opts?: ListOptions<T>,
  ): Promise<Row<T>[]>;
  get<T extends TableName>(table: T, id: string): Promise<Row<T> | null>;
  insert<T extends TableName>(table: T, row: NewRow<T>): Promise<Row<T>>;
  insertMany<T extends TableName>(
    table: T,
    rows: NewRow<T>[],
  ): Promise<Row<T>[]>;
  update<T extends TableName>(
    table: T,
    id: string,
    patch: Partial<Row<T>>,
  ): Promise<Row<T>>;
  remove<T extends TableName>(table: T, id: string): Promise<void>;
  removeWhere<T extends TableName>(
    table: T,
    where: Partial<Row<T>>,
  ): Promise<void>;

  putFile(path: string, data: Uint8Array, contentType: string): Promise<void>;
  getFile(path: string): Promise<{ data: Uint8Array; contentType: string }>;
  removeFile(path: string): Promise<void>;
}

export function sortRows<T>(
  rows: T[],
  key?: string,
  ascending = true,
): T[] {
  if (!key) return rows;
  return [...rows].sort((a, b) => {
    const av = (a as Record<string, unknown>)[key] as string | number;
    const bv = (b as Record<string, unknown>)[key] as string | number;
    if (av === bv) return 0;
    const r = av > bv ? 1 : -1;
    return ascending ? r : -r;
  });
}
