-- La Serre · Floraison V4 · migration non destructive
-- À exécuter une seule fois dans Supabase > SQL Editor (Hub writing).
-- Ne supprime ni ne modifie les placements hebdomadaires existants.
begin;
create table if not exists public.serre_milestone_periods (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  milestone_id uuid not null,
  start_date date not null,
  end_date date not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint serre_period_dates_valid check (end_date >= start_date),
  constraint serre_period_milestone_owner_fk
    foreign key (milestone_id, owner_id)
    references public.serre_milestones(id, owner_id) on delete cascade
);
create index if not exists serre_periods_owner_dates_idx
  on public.serre_milestone_periods(owner_id, start_date, end_date);
create index if not exists serre_periods_milestone_idx
  on public.serre_milestone_periods(milestone_id);
alter table public.serre_milestone_periods enable row level security;
drop policy if exists "serre_periods_select_own" on public.serre_milestone_periods;
create policy "serre_periods_select_own" on public.serre_milestone_periods
  for select to authenticated using (owner_id = (select auth.uid()));
drop policy if exists "serre_periods_insert_own" on public.serre_milestone_periods;
create policy "serre_periods_insert_own" on public.serre_milestone_periods
  for insert to authenticated with check (owner_id = (select auth.uid()));
drop policy if exists "serre_periods_update_own" on public.serre_milestone_periods;
create policy "serre_periods_update_own" on public.serre_milestone_periods
  for update to authenticated using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
drop policy if exists "serre_periods_delete_own" on public.serre_milestone_periods;
create policy "serre_periods_delete_own" on public.serre_milestone_periods
  for delete to authenticated using (owner_id = (select auth.uid()));
commit;

-- Vérification après exécution :
-- select tablename, rowsecurity from pg_tables where schemaname='public' and tablename='serre_milestone_periods';
