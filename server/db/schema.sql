-- 동일 스키마를 로컬 PostgreSQL(PGlite) 및 Supabase에서 사용합니다.
create table if not exists public.baller_players (
 provider text not null, external_id bigint not null check(external_id>0), name text not null,
 nationality text, position text, logo text, profile jsonb,
 updated_at timestamptz not null default now(), primary key(provider,external_id)
);
create index if not exists baller_players_name_idx on public.baller_players(lower(name));
create table if not exists public.baller_teams (
 provider text not null, external_id bigint not null check(external_id>0), name text not null, logo text,
 updated_at timestamptz not null default now(), primary key(provider,external_id)
);
create table if not exists public.baller_matches (
 provider text not null, external_id bigint not null check(external_id>0), played_at timestamptz,
 home_team_id bigint, away_team_id bigint, league_id bigint, league_name text, season integer,
 status text, score text, updated_at timestamptz not null default now(), primary key(provider,external_id),
 foreign key(provider,home_team_id) references public.baller_teams(provider,external_id),
 foreign key(provider,away_team_id) references public.baller_teams(provider,external_id)
);
create index if not exists baller_matches_season_idx on public.baller_matches(provider,season,league_id,played_at desc);
create table if not exists public.baller_player_match_stats (
 provider text not null, player_id bigint not null, match_id bigint not null, team_id bigint,
 minutes numeric check(minutes>=0), goals numeric check(goals>=0), assists numeric check(assists>=0),
 shots numeric check(shots>=0), shots_on_target numeric check(shots_on_target>=0),
 key_passes numeric check(key_passes>=0), tackles numeric check(tackles>=0), interceptions numeric check(interceptions>=0),
 statistics jsonb not null default '{}', updated_at timestamptz not null default now(),
 primary key(provider,player_id,match_id),
 foreign key(provider,player_id) references public.baller_players(provider,external_id),
 foreign key(provider,match_id) references public.baller_matches(provider,external_id),
 foreign key(provider,team_id) references public.baller_teams(provider,external_id)
);
create index if not exists baller_stats_match_idx on public.baller_player_match_stats(provider,match_id);
create table if not exists public.baller_player_seasons (
 provider text not null, player_id bigint not null, club text not null, league text not null, season text not null, competition_type text not null,
 appearances numeric, minutes numeric, goals numeric, assists numeric,
 updated_at timestamptz not null default now(),
 primary key(provider,player_id,club,league,season,competition_type),
 foreign key(provider,player_id) references public.baller_players(provider,external_id)
);
create index if not exists baller_seasons_lookup_idx on public.baller_player_seasons(provider,season,league,player_id);
create table if not exists public.baller_provider_responses (
 scope text not null, path text not null, provider text not null, body jsonb not null,
 fetched_at timestamptz not null default now(), expires_at timestamptz not null,
 primary key(scope,path)
);
create index if not exists baller_responses_expiry_idx on public.baller_provider_responses(expires_at);
create table if not exists public.baller_ingest_runs (
 id bigint generated always as identity primary key, provider text not null, path text not null,
 entity_count integer not null, finished_at timestamptz not null default now()
);

-- 일괄 수집은 단일 RPC 트랜잭션으로 처리하며 일부 기록만 저장하지 않습니다.
create or replace function public.baller_ingest(plan jsonb) returns integer
language plpgsql security invoker set search_path = '' as $$
declare r jsonb; n integer := 0;
begin
 for r in select value from jsonb_array_elements(coalesce(plan->'players','[]')) loop
  insert into public.baller_players(provider,external_id,name,nationality,position,logo,profile)
  values(plan->>'provider',(r->>'external_id')::bigint,r->>'name',r->>'nationality',r->>'position',r->>'logo',r->'profile')
  on conflict(provider,external_id) do update set name=excluded.name,
   nationality=coalesce(excluded.nationality,baller_players.nationality), position=coalesce(excluded.position,baller_players.position),
   logo=coalesce(excluded.logo,baller_players.logo),profile=coalesce(nullif(excluded.profile,'null'::jsonb),baller_players.profile),updated_at=now(); n:=n+1;
 end loop;
 for r in select value from jsonb_array_elements(coalesce(plan->'teams','[]')) loop
  insert into public.baller_teams(provider,external_id,name,logo) values(plan->>'provider',(r->>'external_id')::bigint,r->>'name',r->>'logo')
  on conflict(provider,external_id) do update set name=excluded.name,logo=coalesce(excluded.logo,baller_teams.logo),updated_at=now(); n:=n+1;
 end loop;
 for r in select value from jsonb_array_elements(coalesce(plan->'matches','[]')) loop
  insert into public.baller_matches(provider,external_id,played_at,home_team_id,away_team_id,league_id,league_name,season,status,score)
  values(plan->>'provider',(r->>'external_id')::bigint,(r->>'played_at')::timestamptz,(r->>'home_team_id')::bigint,(r->>'away_team_id')::bigint,(r->>'league_id')::bigint,r->>'league_name',(r->>'season')::integer,r->>'status',r->>'score')
  on conflict(provider,external_id) do update set played_at=coalesce(excluded.played_at,baller_matches.played_at),home_team_id=coalesce(excluded.home_team_id,baller_matches.home_team_id),away_team_id=coalesce(excluded.away_team_id,baller_matches.away_team_id),league_id=coalesce(excluded.league_id,baller_matches.league_id),league_name=coalesce(excluded.league_name,baller_matches.league_name),season=coalesce(excluded.season,baller_matches.season),status=coalesce(excluded.status,baller_matches.status),score=coalesce(excluded.score,baller_matches.score),updated_at=now(); n:=n+1;
 end loop;
 for r in select value from jsonb_array_elements(coalesce(plan->'seasons','[]')) loop
  insert into public.baller_player_seasons(provider,player_id,club,league,season,competition_type,appearances,minutes,goals,assists)
  values(plan->>'provider',(r->>'player_id')::bigint,r->>'club',r->>'league',r->>'season',r->>'competition_type',(r->>'appearances')::numeric,(r->>'minutes')::numeric,(r->>'goals')::numeric,(r->>'assists')::numeric)
  on conflict(provider,player_id,club,league,season,competition_type) do update set appearances=excluded.appearances,minutes=excluded.minutes,goals=excluded.goals,assists=excluded.assists,updated_at=now(); n:=n+1;
 end loop;
 for r in select value from jsonb_array_elements(coalesce(plan->'stats','[]')) loop
  insert into public.baller_player_match_stats(provider,player_id,match_id,team_id,minutes,goals,assists,shots,shots_on_target,key_passes,tackles,interceptions,statistics)
  values(plan->>'provider',(r->>'player_id')::bigint,(r->>'match_id')::bigint,(r->>'team_id')::bigint,(r->>'minutes')::numeric,(r->>'goals')::numeric,(r->>'assists')::numeric,(r->>'shots')::numeric,(r->>'shots_on_target')::numeric,(r->>'key_passes')::numeric,(r->>'tackles')::numeric,(r->>'interceptions')::numeric,coalesce(r->'statistics','{}'))
  on conflict(provider,player_id,match_id) do update set team_id=excluded.team_id,minutes=excluded.minutes,goals=excluded.goals,assists=excluded.assists,shots=excluded.shots,shots_on_target=excluded.shots_on_target,key_passes=excluded.key_passes,tackles=excluded.tackles,interceptions=excluded.interceptions,statistics=excluded.statistics,updated_at=now(); n:=n+1;
 end loop;
 if plan ? 'cache' then
  insert into public.baller_provider_responses(scope,path,provider,body,fetched_at,expires_at)
  values(plan->'cache'->>'scope',plan->>'path',plan->>'provider',plan->'cache'->'body',coalesce((plan->'cache'->>'fetched_at')::timestamptz,now()),(plan->'cache'->>'expires_at')::timestamptz)
  on conflict(scope,path) do update set body=excluded.body,fetched_at=excluded.fetched_at,expires_at=excluded.expires_at;
 end if;
 insert into public.baller_ingest_runs(provider,path,entity_count) values(plan->>'provider',plan->>'path',n);
 return n;
end $$;
revoke all on function public.baller_ingest(jsonb) from public;
-- Supabase는 서버 secret/service_role만 접근합니다. 브라우저 직접 쓰기는 허용하지 않습니다.
do $$ declare t text; begin
 foreach t in array array['baller_players','baller_teams','baller_matches','baller_player_match_stats','baller_player_seasons','baller_provider_responses','baller_ingest_runs'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on table public.%I from public',t);
  if exists(select 1 from pg_roles where rolname='anon') then execute format('revoke all on table public.%I from anon',t); end if;
  if exists(select 1 from pg_roles where rolname='authenticated') then execute format('revoke all on table public.%I from authenticated',t); end if;
  if exists(select 1 from pg_roles where rolname='service_role') then
   execute format('grant all on table public.%I to service_role',t);
   if not exists(select 1 from pg_policies where schemaname='public' and tablename=t and policyname='baller_server_only') then execute format('create policy baller_server_only on public.%I for all to service_role using (true) with check (true)',t); end if;
  end if;
 end loop;
 if exists(select 1 from pg_roles where rolname='anon') then revoke all on function public.baller_ingest(jsonb) from anon; end if;
 if exists(select 1 from pg_roles where rolname='authenticated') then revoke all on function public.baller_ingest(jsonb) from authenticated; end if;
 if exists(select 1 from pg_roles where rolname='service_role') then
  grant execute on function public.baller_ingest(jsonb) to service_role;
  grant usage,select on sequence public.baller_ingest_runs_id_seq to service_role;
 end if;
end $$;
