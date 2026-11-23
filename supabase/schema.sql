-- Run once in the Supabase SQL editor. Enable Email/password and Google OAuth authentication in Supabase.
create extension if not exists pgcrypto;
create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default 'مشجع كورهسطين',
 role text not null default 'fan' check(role in ('fan','admin')),
 created_at timestamptz not null default now(),
 constraint display_name_length check (char_length(display_name) between 2 and 40)
);
create table if not exists public.predictions (
 id bigint generated always as identity primary key,
 user_id uuid not null references public.profiles(id) on delete cascade,
 fixture_id bigint not null,
 league_id integer not null,
 kickoff timestamptz not null,
 home_score smallint not null check(home_score between 0 and 20),
 away_score smallint not null check(away_score between 0 and 20),
 points integer not null default 0 check(points >= 0),
 settled boolean not null default false,
 created_at timestamptz not null default now(),
 unique(user_id,fixture_id)
);
create index if not exists predictions_fixture_idx on public.predictions(fixture_id) where settled=false;
create index if not exists predictions_user_idx on public.predictions(user_id);
create or replace function public.new_user_profile() returns trigger language plpgsql security definer set search_path = public as $$
begin
 insert into public.profiles(id,display_name) values(new.id,coalesce(nullif(left(trim(new.raw_user_meta_data->>'display_name'),40),''),'مشجع كورهسطين')) on conflict(id) do nothing;
 return new;
end;$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.new_user_profile();
insert into public.profiles(id) select id from auth.users on conflict(id) do nothing;
alter table public.profiles enable row level security;
alter table public.predictions enable row level security;
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using (true);
drop policy if exists predictions_own_read on public.predictions;
create policy predictions_own_read on public.predictions for select to authenticated using (user_id=auth.uid());
-- No direct client INSERT/UPDATE/DELETE policies. Only the server's service role can write.
revoke all on function public.new_user_profile() from public,anon,authenticated;
create or replace function public.submit_prediction(p_user_id uuid,p_fixture_id bigint,p_league_id integer,p_kickoff timestamptz,p_home integer,p_away integer)
returns void language plpgsql security definer set search_path=public as $$
begin
 if p_kickoff<=now() then raise exception 'Kickoff has passed'; end if;
 if p_home not between 0 and 20 or p_away not between 0 and 20 then raise exception 'Invalid score'; end if;
 insert into public.predictions(user_id,fixture_id,league_id,kickoff,home_score,away_score)
 values(p_user_id,p_fixture_id,p_league_id,p_kickoff,p_home,p_away)
 on conflict(user_id,fixture_id) do update set home_score=excluded.home_score,away_score=excluded.away_score,created_at=now()
 where predictions.settled=false and predictions.kickoff>now();
 if not found then raise exception 'Prediction locked'; end if;
end;$$;
create or replace function public.settle_fixture(p_fixture_id bigint,p_home integer,p_away integer)
returns integer language plpgsql security definer set search_path=public as $$
declare affected integer;
begin
 if p_home not between 0 and 30 or p_away not between 0 and 30 then raise exception 'Invalid final score'; end if;
 update public.predictions p set points=(case
  when p.home_score=p_home and p.away_score=p_away then 100
  when sign(p.home_score-p.away_score)=sign(p_home-p_away) then 40
  when p.home_score+p.away_score=p_home+p_away then 20
  else 0 end),settled=true
 where p.fixture_id=p_fixture_id and p.settled=false and p.created_at<p.kickoff;
 get diagnostics affected=row_count;
 return affected;
end;$$;
revoke all on function public.submit_prediction(uuid,bigint,integer,timestamptz,integer,integer) from public,anon,authenticated;
revoke all on function public.settle_fixture(bigint,integer,integer) from public,anon,authenticated;
grant execute on function public.submit_prediction(uuid,bigint,integer,timestamptz,integer,integer) to service_role;
grant execute on function public.settle_fixture(bigint,integer,integer) to service_role;
create or replace view public.leaderboard with (security_invoker=true) as
 select p.id,p.display_name,coalesce(sum(pr.points),0)::bigint as xp,count(pr.id) filter(where pr.settled)::integer as settled_predictions
 from public.profiles p left join public.predictions pr on pr.user_id=p.id group by p.id,p.display_name;
grant select on public.leaderboard to authenticated;
-- IMPORTANT: scoring is initiated by POST /api/settle with CRON_SECRET, not automatically scheduled.
