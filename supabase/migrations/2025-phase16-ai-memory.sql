-- Phase 16 – AI Memory persistent schema
-- Safe extensions
create extension if not exists pgcrypto;

-- ai_memory table
create table if not exists public.ai_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role text not null,
  type text not null check (type in ('user_message','assistant_message','action')),
  content text not null,
  intent text,
  created_at timestamptz not null default now()
);

-- Helpful indexes
create index if not exists idx_ai_memory_user_created on public.ai_memory(user_id, created_at desc);
create index if not exists idx_ai_memory_user on public.ai_memory(user_id);

-- Optional: RLS and policies (disabled by default to allow service role writes)
-- alter table public.ai_memory enable row level security;
-- create policy "service can do all" on public.ai_memory for all using (true) with check (true);

-- Optional: retention can be handled by a cron/job; for now app performs purge on writes
