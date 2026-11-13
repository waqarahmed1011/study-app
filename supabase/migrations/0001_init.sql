-- study.ai schema. Run in the Supabase SQL editor (or `supabase db push`).
-- Every table is private to its owner through row-level security.

create extension if not exists pgcrypto;

create table if not exists public.kits (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null default 'Untitled kit',
  emoji text not null default '📘',
  status text not null default 'draft' check (status in ('draft','generating','ready','error')),
  gen_steps jsonb not null default '{}'::jsonb,
  gen_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sources (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  kit_id text not null references public.kits on delete cascade,
  kind text not null check (kind in ('pdf','image','text','diagram')),
  name text not null,
  storage_path text,
  mime text,
  extracted_md text,
  status text not null default 'pending' check (status in ('pending','done','error')),
  error text,
  generated boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.topics (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  kit_id text not null references public.kits on delete cascade,
  name text not null,
  description text not null default '',
  mastery real not null default 0,
  attempts int not null default 0,
  correct int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.flashcards (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  kit_id text not null references public.kits on delete cascade,
  topic_id text references public.topics on delete set null,
  front text not null,
  back text not null,
  fsrs jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.diagrams (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  kit_id text not null references public.kits on delete cascade,
  source_id text not null references public.sources on delete cascade,
  topic_id text references public.topics on delete set null,
  title text not null,
  regions jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft','confirmed')),
  created_at timestamptz not null default now()
);

create table if not exists public.questions (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  kit_id text not null references public.kits on delete cascade,
  topic_id text references public.topics on delete set null,
  type text not null check (type in ('mcq','multi_select','true_false','short_answer','matching','ordering')),
  prompt text not null,
  payload jsonb not null default '{}'::jsonb,
  answer jsonb not null,
  explanation text not null default '',
  difficulty int not null default 2 check (difficulty between 1 and 3),
  origin text not null default 'kit' check (origin in ('kit','diagram')),
  diagram_id text references public.diagrams on delete cascade,
  verified boolean not null default true,
  rating int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.attempts (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  kit_id text not null references public.kits on delete cascade,
  question_id text references public.questions on delete cascade,
  topic_id text references public.topics on delete set null,
  session_id text,
  mode text not null check (mode in ('smart','test','flashcards','diagram')),
  correct boolean not null,
  score real not null default 0,
  response jsonb,
  feedback text,
  created_at timestamptz not null default now()
);

create table if not exists public.tests (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  kit_id text not null references public.kits on delete cascade,
  title text not null,
  config jsonb not null,
  question_ids jsonb not null default '[]'::jsonb,
  status text not null default 'ready' check (status in ('ready','submitted')),
  score real,
  results jsonb,
  responses jsonb,
  started_at timestamptz,
  submitted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.documents (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  kit_id text not null references public.kits on delete cascade,
  kind text not null check (kind in ('guide','summary')),
  content_md text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  kit_id text not null references public.kits on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

-- indexes for the common "everything in this kit" lookups
create index if not exists sources_kit on public.sources (kit_id);
create index if not exists topics_kit on public.topics (kit_id);
create index if not exists flashcards_kit on public.flashcards (kit_id);
create index if not exists questions_kit on public.questions (kit_id);
create index if not exists attempts_kit on public.attempts (kit_id, created_at);
create index if not exists attempts_user on public.attempts (user_id, created_at);
create index if not exists tests_kit on public.tests (kit_id);
create index if not exists documents_kit on public.documents (kit_id);
create index if not exists chat_kit on public.chat_messages (kit_id, created_at);
create index if not exists diagrams_kit on public.diagrams (kit_id);

-- row-level security: owner only
do $$
declare t text;
begin
  foreach t in array array['kits','sources','topics','flashcards','diagrams','questions','attempts','tests','documents','chat_messages']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists owner_all on public.%I', t);
    execute format(
      'create policy owner_all on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

-- private storage bucket for uploads; files live under <user_id>/...
insert into storage.buckets (id, name, public)
values ('sources', 'sources', false)
on conflict (id) do nothing;

drop policy if exists "own files read" on storage.objects;
drop policy if exists "own files write" on storage.objects;
drop policy if exists "own files update" on storage.objects;
drop policy if exists "own files delete" on storage.objects;
create policy "own files read" on storage.objects for select to authenticated
  using (bucket_id = 'sources' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own files write" on storage.objects for insert to authenticated
  with check (bucket_id = 'sources' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own files update" on storage.objects for update to authenticated
  using (bucket_id = 'sources' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own files delete" on storage.objects for delete to authenticated
  using (bucket_id = 'sources' and (storage.foldername(name))[1] = auth.uid()::text);
