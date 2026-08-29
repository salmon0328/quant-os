-- Quant-OS cross-device sync schema.
-- Run this once in your Supabase project: Dashboard -> SQL Editor -> New query -> paste -> Run.

create table if not exists public.app_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

drop policy if exists "app_state_select_own" on public.app_state;
create policy "app_state_select_own"
  on public.app_state for select
  using (auth.uid() = user_id);

drop policy if exists "app_state_insert_own" on public.app_state;
create policy "app_state_insert_own"
  on public.app_state for insert
  with check (auth.uid() = user_id);

drop policy if exists "app_state_update_own" on public.app_state;
create policy "app_state_update_own"
  on public.app_state for update
  using (auth.uid() = user_id);

-- RLS policies alone are not enough: Postgres also requires base table-level
-- privileges before it even checks row-level policies. Without this GRANT,
-- every query fails with "permission denied for table app_state" even if
-- the policies above are 100% correct.
grant select, insert, update on public.app_state to authenticated;

-- Enable Realtime so a change on one device shows up live on another
-- (also possible via Dashboard -> Database -> Replication -> app_state).
-- Wrapped so re-running this script is safe even if the table is already
-- a member of the publication (raises 42710 otherwise, which aborts the
-- whole script/transaction in the SQL Editor and silently rolls back the
-- policies/grants created above).
do $$
begin
  begin
    alter publication supabase_realtime add table public.app_state;
  exception when duplicate_object then
    null;
  end;
end $$;
