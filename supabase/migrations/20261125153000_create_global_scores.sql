create table if not exists public.global_scores (
  telegram_user_id bigint not null,
  location text not null check (location in ('wildwood', 'castle')),
  display_name text not null check (char_length(display_name) between 1 and 24),
  levels_completed integer not null check (levels_completed between 1 and 1000),
  destroyed integer not null check (destroyed between 0 and 1000000),
  shots integer not null check (shots between 0 and 10000000),
  weapon text not null check (weapon in ('ember', 'frost', 'starlight', 'none yet')),
  updated_at timestamptz not null default now(),
  primary key (telegram_user_id, location)
);

create index if not exists global_scores_ranking_idx
  on public.global_scores (location, levels_completed desc, destroyed desc, shots asc, display_name asc);

alter table public.global_scores enable row level security;
revoke all on table public.global_scores from anon, authenticated;
grant all on table public.global_scores to service_role;
