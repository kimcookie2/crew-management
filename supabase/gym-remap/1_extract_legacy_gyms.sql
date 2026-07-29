-- [1단계] 아직 텍스트로 남아있는 암장명 목록 추출
-- Supabase SQL Editor 에서 실행 → 결과를 CSV 로 내보내 엑셀에서 편집.
-- (gym_id 가 이미 지정된 이벤트는 정리 완료된 것이라 제외)

select
  e.gym_name,
  count(*) as event_count
from public.events e
where e.gym_id is null
  and coalesce(trim(e.gym_name), '') <> ''
group by e.gym_name
order by count(*) desc, e.gym_name;
