-- Card order numbers are timestamps in milliseconds (~1.8e12), which overflow a
-- 32-bit integer ("value is out of range for type integer"). Use bigint.
alter table public.flashcards alter column position type bigint;
