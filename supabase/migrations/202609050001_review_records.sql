-- Apply once through Supabase SQL Editor or your migration deployment workflow.
begin;
create table public.keystone_reviews (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  repository text not null check (length(repository) between 1 and 300),
  created_at timestamptz not null default now(),
  base_sha text not null check (base_sha ~ '^[0-9a-f]{40,64}$'),
  head_sha text not null check (head_sha ~ '^[0-9a-f]{40,64}$'),
  report jsonb not null check (jsonb_typeof(report) = 'object' and report->>'version' = '1'),
  constraint report_commits_match check (report->>'base' = base_sha and report->>'head' = head_sha)
);
alter table public.keystone_reviews enable row level security;
revoke all on public.keystone_reviews from anon, authenticated;
grant select, insert on public.keystone_reviews to authenticated;
create policy "Owners read their reviews" on public.keystone_reviews
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "Owners insert their reviews" on public.keystone_reviews
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create index keystone_reviews_owner_repository_time
  on public.keystone_reviews (owner_id, repository, created_at desc);
commit;
