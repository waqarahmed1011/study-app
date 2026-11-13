-- Kit generation steps now run in parallel, so step status must be updated in
-- one statement (row lock) instead of read-modify-write from the app.
create or replace function public.set_kit_step(p_kit text, p_step text, p_status text, p_error text default null)
returns public.kits
language sql
security invoker
set search_path = public
as $$
  update public.kits k
  set gen_steps = k.gen_steps || jsonb_build_object(p_step, p_status),
      gen_error = case when p_status = 'error' then coalesce(p_error, 'Unknown error') else k.gen_error end,
      status = case
        when k.status = 'ready' then 'ready'
        when p_status = 'error' then 'error'
        when (select count(*) from jsonb_each_text(k.gen_steps || jsonb_build_object(p_step, p_status)) e
              where e.key in ('extract','outline','flashcards','questions','guide','summary') and e.value = 'done') = 6 then 'ready'
        else 'generating'
      end,
      updated_at = now()
  where k.id = p_kit and k.user_id = auth.uid()
  returning k.*;
$$;

grant execute on function public.set_kit_step(text, text, text, text) to authenticated;
