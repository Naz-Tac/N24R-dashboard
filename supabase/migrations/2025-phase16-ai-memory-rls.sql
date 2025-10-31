-- Phase 16-p2 – Enable RLS and policies for ai_memory

alter table if exists public.ai_memory enable row level security;

-- Drop existing policies if re-running (safe guards)
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='ai_memory' and policyname='ai_memory_select_own') then
    drop policy ai_memory_select_own on public.ai_memory;
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='ai_memory' and policyname='ai_memory_insert_own') then
    drop policy ai_memory_insert_own on public.ai_memory;
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='ai_memory' and policyname='ai_memory_delete_own') then
    drop policy ai_memory_delete_own on public.ai_memory;
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='ai_memory' and policyname='ai_memory_update_own') then
    drop policy ai_memory_update_own on public.ai_memory;
  end if;
end $$;

create policy ai_memory_select_own on public.ai_memory
  for select
  using (auth.uid() = user_id);

create policy ai_memory_insert_own on public.ai_memory
  for insert
  with check (auth.uid() = user_id);

create policy ai_memory_delete_own on public.ai_memory
  for delete
  using (auth.uid() = user_id);

-- Optional: Update policy (not used now but safe to add)
create policy ai_memory_update_own on public.ai_memory
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
