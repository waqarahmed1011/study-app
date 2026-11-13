// Which backends are active. Supabase is used when its URL + key are set;
// otherwise the app runs on the local JSON store (single user, no login).
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const useSupabase = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const APP_NAME = "study.ai";
