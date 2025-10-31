-- Phase 19: AI Assignment Audit table
create extension if not exists pgcrypto;

create table if not exists public.ai_assignment_audit (
  id uuid primary key default gen_random_uuid(),
  timestamp timestamptz not null default now(),
  shift_id uuid,
  agent_id uuid,
  score numeric,
  criteria jsonb,
  guardrails jsonb,
  auto_assigned boolean default false,
  role text,
  user_id uuid
);

create index if not exists idx_ai_assignment_audit_shift on public.ai_assignment_audit(shift_id);
create index if not exists idx_ai_assignment_audit_agent on public.ai_assignment_audit(agent_id);
