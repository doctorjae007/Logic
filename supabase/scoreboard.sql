create table if not exists public.logic_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  player_name text not null check (char_length(btrim(player_name)) between 2 and 24),
  player_emoji text not null check (char_length(player_emoji) between 1 and 8),
  score integer not null check (score between 0 and 110),
  correct_count integer not null check (correct_count >= 0),
  total_count integer not null check (total_count > 0 and correct_count <= total_count),
  difficulty text not null check (difficulty in ('basic', 'intermediate', 'challenge')),
  challenge_title text not null check (char_length(challenge_title) between 1 and 80),
  challenge_formula text not null check (char_length(challenge_formula) between 1 and 120),
  duration_ms integer not null check (duration_ms >= 0),
  completed_at timestamptz not null default now()
);

create index if not exists logic_scores_leaderboard_idx
  on public.logic_scores (score desc, duration_ms asc, completed_at desc);

alter table public.logic_scores enable row level security;

drop policy if exists "Anyone can read scoreboard" on public.logic_scores;
create policy "Anyone can read scoreboard"
  on public.logic_scores for select
  to anon, authenticated
  using (true);

drop policy if exists "Players can submit their own scores" on public.logic_scores;
create policy "Players can submit their own scores"
  on public.logic_scores for insert
  to authenticated
  with check (auth.uid() = user_id);
