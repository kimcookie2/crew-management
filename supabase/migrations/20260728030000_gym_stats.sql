-- ============================================================================
-- 암장 통계 RPC: 기간 범위 내 브랜드/지점별 모임 수 + 참석 연인원 (DRAFT)
-- ----------------------------------------------------------------------------
-- 지점 단위로 반환 → 프론트에서 브랜드별은 gym_id 로 합산.
-- p_from/p_to 는 null 이면 전체 범위. gym_id 없는(텍스트 미정리) 이벤트는 제외.
-- ⚠️ 기본 rollback. 검증 후 commit.
-- ============================================================================

begin;

create or replace function public.get_crew_gym_stats(
  p_crew_id uuid,
  p_from date default null,
  p_to date default null
)
returns table(
  gym_id uuid,
  gym_name text,
  branch_id uuid,
  branch_name text,
  event_count integer,
  attendee_count integer
)
language sql
stable security definer
set search_path to 'public'
as $$
  select
    e.gym_id,
    g.name as gym_name,
    e.branch_id,
    b.name as branch_name,
    count(distinct e.id)::int as event_count,
    count(a.id)::int as attendee_count
  from public.events e
  join public.gyms g on g.id = e.gym_id
  left join public.gym_branches b on b.id = e.branch_id
  left join public.attendances a on a.event_id = e.id
  where e.crew_id = p_crew_id
    and public.is_crew_member(p_crew_id)
    and (p_from is null or e.event_date >= p_from)
    and (p_to   is null or e.event_date <= p_to)
  group by e.gym_id, g.name, e.branch_id, b.name
  order by event_count desc, attendee_count desc, g.name;
$$;

-- commit;
rollback;
