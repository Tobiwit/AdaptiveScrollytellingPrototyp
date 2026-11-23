-- Run once in the Supabase SQL editor.

create table if not exists public.runs (
  id uuid primary key,
  participant text,
  condition text,
  exhibition text,
  build text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  data jsonb not null
);

-- RLS on and no policies: the public key can neither read nor write the table, only call save_run().
alter table public.runs enable row level security;

create or replace function public.save_run(
  p_id uuid,
  p_participant text,
  p_condition text,
  p_exhibition text,
  p_build text,
  p_data jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if octet_length(p_data::text) > 20000000 then
    raise exception 'run too large';
  end if;
  insert into runs (id, participant, condition, exhibition, build, data)
  values (p_id, p_participant, p_condition, p_exhibition, p_build, p_data)
  on conflict (id) do update set data = excluded.data, updated_at = now();
end;
$$;

revoke all on function public.save_run from public;
grant execute on function public.save_run to anon;
