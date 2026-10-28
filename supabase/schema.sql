-- Run once in a NEW Supabase project's SQL Editor.
create table public.tasks (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 title text not null check (char_length(btrim(title)) between 1 and 120),
 description text not null default '' check (char_length(description) <= 2000),
 due_date date,
 completed boolean not null default false,
 created_at timestamptz not null default now()
);
create index tasks_owner_created_idx on public.tasks(user_id, created_at desc);
alter table public.tasks enable row level security;
revoke all on public.tasks from anon;
grant select, insert, update, delete on public.tasks to authenticated;
create policy "Read own tasks" on public.tasks for select to authenticated
 using ((select auth.uid()) = user_id);
create policy "Create own tasks" on public.tasks for insert to authenticated
 with check ((select auth.uid()) = user_id);
create policy "Update own tasks" on public.tasks for update to authenticated
 using ((select auth.uid()) = user_id)
 with check ((select auth.uid()) = user_id);
create policy "Delete own tasks" on public.tasks for delete to authenticated
 using ((select auth.uid()) = user_id);
