-- Pictures on flashcards and questions, card ordering, and links back to the
-- diagram region a generated card/question came from.

alter table public.flashcards
  add column if not exists front_image jsonb,
  add column if not exists back_image jsonb,
  add column if not exists position bigint not null default 0,
  add column if not exists diagram_id text references public.diagrams on delete cascade,
  add column if not exists region_id text,
  add column if not exists gen_kind text;

alter table public.questions
  add column if not exists image jsonb,
  add column if not exists region_id text,
  add column if not exists gen_kind text;

create index if not exists flashcards_diagram on public.flashcards (diagram_id);
