-- ============================================================================
-- 암장 카탈로그 (브랜드 → 지점 2단계) 도입 (DRAFT — 검토/백업 후 실행)
-- ----------------------------------------------------------------------------
-- 설계:
--   gyms(브랜드)  1 ─── N  gym_branches(지점)
--   events 에 gym_id(필수) + branch_id(선택) 추가, 기존 gym_name 은 레거시 보존.
--   - 원뎁스 암장: gyms 에만 존재, branch 없음 → 이벤트는 gym_id 만.
--   - 투뎁스 암장: gym_branches 에 지점 등록 → 이벤트는 gym_id + branch_id.
--   카탈로그: 전역 공유. 읽기=authenticated 전원, 쓰기=아무 크루 admin(RPC 경유).
--
-- ⚠️ 실행 전: DB 백업 확보 → 아래 트랜잭션은 기본 rollback. 검증 후 commit 으로 변경.
-- ============================================================================

begin;

-- ── 1. 카탈로그 테이블 ──────────────────────────────────────────────────────
create table if not exists public.gyms (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,                 -- 더클라임 / 서울숲 / 클라이밍파크
  is_active  boolean not null default true,        -- false = 미사용(일정등록 드롭다운에서 숨김, 기록은 유지)
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.gym_branches (
  id         uuid primary key default gen_random_uuid(),
  gym_id     uuid not null references public.gyms(id) on delete cascade,
  name       text not null,                        -- 신림 / 종로 / 연남
  is_active  boolean not null default true,        -- false = 미사용
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (gym_id, name)
);

create index if not exists gym_branches_gym_id_idx on public.gym_branches(gym_id);


-- ── 2. events 확장 ──────────────────────────────────────────────────────────
alter table public.events
  add column if not exists gym_id    uuid references public.gyms(id),
  add column if not exists branch_id uuid references public.gym_branches(id);

create index if not exists events_gym_id_idx    on public.events(gym_id);
create index if not exists events_branch_id_idx on public.events(branch_id);


-- ── 3. 초기 카탈로그 시드 ───────────────────────────────────────────────────
-- 기존 이벤트의 gym_name 텍스트는 백필하지 않음(카탈로그 오염 방지).
-- 레거시 이벤트는 gym_name 텍스트로 계속 표시되고, 편집 화면에서 정식 카탈로그로 재매핑.
insert into public.gyms(name) values
  ('더클라임'), ('서울숲'), ('클라이밍파크'), ('볼더생활'), ('오프더월'), ('훅클라임')
on conflict (name) do nothing;

insert into public.gym_branches(gym_id, name)
select g.id, v.name
from public.gyms g
join (values
  ('더클라임','강남'), ('더클라임','논현'), ('더클라임','마곡'), ('더클라임','문래'),
  ('더클라임','사당'), ('더클라임','성수'), ('더클라임','신림'), ('더클라임','양재'),
  ('더클라임','연남'), ('더클라임','이수'), ('더클라임','일산'), ('더클라임','목동'),
  ('서울숲','구로'), ('서울숲','종로'), ('서울숲','영등포'), ('서울숲','뚝섬'), ('서울숲','잠실'),
  ('클라이밍파크','성수'), ('클라이밍파크','강남'), ('클라이밍파크','종로'),
  ('클라이밍파크','신논현'), ('클라이밍파크','한티')
) as v(brand, name) on v.brand = g.name
on conflict (gym_id, name) do nothing;
-- 볼더생활 / 오프더월 / 훅클라임 = 단일 지점(지점 row 없음).


-- ── 4. RLS: 읽기만 허용, 쓰기는 SECURITY DEFINER RPC 로만 ───────────────────
alter table public.gyms         enable row level security;
alter table public.gym_branches enable row level security;

drop policy if exists gyms_read_authenticated on public.gyms;
create policy gyms_read_authenticated on public.gyms
  for select to authenticated using (true);

drop policy if exists branches_read_authenticated on public.gym_branches;
create policy branches_read_authenticated on public.gym_branches
  for select to authenticated using (true);
-- INSERT/UPDATE/DELETE 정책 없음 → 직접 쓰기 차단, 아래 RPC(정의자 권한)로만 변경.


-- ── 5. 권한 헬퍼: 아무 크루의 admin 인가 ────────────────────────────────────
create or replace function public.is_any_crew_admin()
returns boolean
language sql stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.crew_memberships cm
    where (
        cm.user_id = auth.uid()
        or cm.person_id = (select person_id from public.profiles where id = auth.uid())
      )
      and cm.role = 'admin'
      and cm.status <> 'exited'
  );
$$;


-- ── 6. 카탈로그 관리 RPC (admin 전용) ───────────────────────────────────────
create or replace function public.admin_add_gym(p_name text)
returns uuid
language plpgsql security definer
set search_path to 'public'
as $$
declare v_id uuid;
begin
  if not public.is_any_crew_admin() then raise exception 'forbidden'; end if;
  if coalesce(trim(p_name),'') = '' then raise exception 'empty_name'; end if;

  insert into public.gyms(name) values (trim(p_name))
  on conflict (name) do update set name = excluded.name  -- 멱등: 기존 id 반환
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.admin_add_gym_branch(p_gym_id uuid, p_name text)
returns uuid
language plpgsql security definer
set search_path to 'public'
as $$
declare v_id uuid;
begin
  if not public.is_any_crew_admin() then raise exception 'forbidden'; end if;
  if coalesce(trim(p_name),'') = '' then raise exception 'empty_name'; end if;
  if not exists (select 1 from public.gyms where id = p_gym_id) then
    raise exception 'gym_not_found';
  end if;

  insert into public.gym_branches(gym_id, name) values (p_gym_id, trim(p_name))
  on conflict (gym_id, name) do update set name = excluded.name
  returning id into v_id;
  return v_id;
end $$;

-- 미사용/사용 토글 (삭제 대신 숨김 — 기존 이벤트 기록은 유지)
create or replace function public.admin_set_gym_active(p_gym_id uuid, p_active boolean)
returns void
language plpgsql security definer
set search_path to 'public'
as $$
begin
  if not public.is_any_crew_admin() then raise exception 'forbidden'; end if;
  update public.gyms set is_active = p_active where id = p_gym_id;
  if not found then raise exception 'gym_not_found'; end if;
end $$;

create or replace function public.admin_set_gym_branch_active(p_branch_id uuid, p_active boolean)
returns void
language plpgsql security definer
set search_path to 'public'
as $$
begin
  if not public.is_any_crew_admin() then raise exception 'forbidden'; end if;
  update public.gym_branches set is_active = p_active where id = p_branch_id;
  if not found then raise exception 'branch_not_found'; end if;
end $$;


-- ── 7. 이벤트 RPC 를 gym_id/branch_id 기반으로 교체 ─────────────────────────
-- 기존 gym_name 기반 시그니처 제거
drop function if exists public.create_event_and_attendances(uuid, date, text, uuid[]);
drop function if exists public.update_event(uuid, uuid, date, text);

create or replace function public.create_event_and_attendances(
  p_crew_id uuid, p_event_date date, p_gym_id uuid, p_branch_id uuid, p_membership_ids uuid[]
)
returns uuid
language plpgsql security definer
set search_path to 'public'
as $$
declare v_event_id uuid;
begin
  if not public.is_crew_admin(p_crew_id) then raise exception 'forbidden: admin only'; end if;
  if not exists (select 1 from public.gyms where id = p_gym_id) then
    raise exception 'gym_not_found';
  end if;
  -- branch 를 지정했으면 해당 gym 소속이어야 함
  if p_branch_id is not null and not exists (
    select 1 from public.gym_branches b where b.id = p_branch_id and b.gym_id = p_gym_id
  ) then
    raise exception 'branch_mismatch';
  end if;
  -- 지점이 있는 암장은 지점 선택 필수
  if p_branch_id is null and exists (
    select 1 from public.gym_branches b where b.gym_id = p_gym_id
  ) then
    raise exception 'branch_required';
  end if;

  insert into public.events (crew_id, event_date, gym_id, branch_id)
  values (p_crew_id, p_event_date, p_gym_id, p_branch_id)
  returning id into v_event_id;

  insert into public.attendances (event_id, membership_id)
  select v_event_id, cm.id
  from public.crew_memberships cm
  where cm.crew_id = p_crew_id and cm.id = any(p_membership_ids)
  on conflict (event_id, membership_id) do nothing;

  return v_event_id;
end $$;

create or replace function public.update_event(
  p_crew_id uuid, p_event_id uuid, p_event_date date, p_gym_id uuid, p_branch_id uuid
)
returns void
language plpgsql security definer
set search_path to 'public'
as $$
begin
  if not public.is_crew_admin(p_crew_id) then raise exception 'forbidden: admin only'; end if;
  if not exists (select 1 from public.gyms where id = p_gym_id) then
    raise exception 'gym_not_found';
  end if;
  if p_branch_id is not null and not exists (
    select 1 from public.gym_branches b where b.id = p_branch_id and b.gym_id = p_gym_id
  ) then
    raise exception 'branch_mismatch';
  end if;
  if p_branch_id is null and exists (
    select 1 from public.gym_branches b where b.gym_id = p_gym_id
  ) then
    raise exception 'branch_required';
  end if;

  update public.events
  set event_date = p_event_date, gym_id = p_gym_id, branch_id = p_branch_id
  where id = p_event_id and crew_id = p_crew_id;

  if not found then raise exception 'not found'; end if;
end $$;


-- ── 8. 조회 RPC: 표시용 gym 라벨을 카탈로그에서 생성(레거시 텍스트 fallback) ──
-- 반환 컬럼(gym_id/branch_id) 추가 → 반환 타입 변경이라 CREATE OR REPLACE 불가, DROP 먼저.
drop function if exists public.get_crew_events_by_date(uuid, date);
create or replace function public.get_crew_events_by_date(p_crew_id uuid, p_event_date date)
returns table(
  event_id uuid, event_date date,
  gym_id uuid, branch_id uuid, gym_name text,
  attendee_count integer, attendee_names text[]
)
language sql stable security definer
set search_path to 'public'
as $$
  select
    e.id as event_id,
    e.event_date,
    e.gym_id,
    e.branch_id,
    coalesce(
      nullif(trim(g.name || ' ' || coalesce(b.name, '')), ''),
      e.gym_name
    ) as gym_name,                                    -- "더클라임 신림" / "서울숲" / 레거시 텍스트
    count(a.id)::int as attendee_count,
    coalesce(
      array_agg(cm.display_name order by cm.display_name)
        filter (where cm.display_name is not null),
      '{}'::text[]
    ) as attendee_names
  from public.events e
  left join public.gyms g          on g.id = e.gym_id
  left join public.gym_branches b  on b.id = e.branch_id
  left join public.attendances a   on a.event_id = e.id
  left join public.crew_memberships cm on cm.id = a.membership_id
  where e.crew_id = p_crew_id
    and e.event_date = p_event_date
  group by e.id, e.event_date, e.gym_id, e.branch_id, g.name, b.name, e.gym_name
  order by g.name nulls last, b.name nulls first, e.id;
$$;


-- ── (선택) 초기 카탈로그 시드 — 실제 지점 구조에 맞게 채워서 사용 ────────────
-- with x as (
--   insert into public.gyms(name) values ('더클라임')
--   on conflict (name) do update set name = excluded.name returning id
-- )
-- insert into public.gym_branches(gym_id, name)
-- select x.id, v.name from x, (values ('신림'),('종로'),('연남')) v(name)
-- on conflict (gym_id, name) do nothing;


-- 검증 후 아래 주석 해제하여 확정:
-- commit;
rollback;   -- 기본은 rollback: 검증 없이 실수로 실행돼도 안전
