-- ============================================================================
-- 죽은 객체 정리 (DRAFT — 검토/백업 후 실행)
-- ----------------------------------------------------------------------------
-- 근거: SCHEMA.md 의 "완전히 죽은 함수 / 테이블" 분석.
--   - 코드베이스(src) grep 결과 어디서도 호출 없음
--   - 다른 DB 함수/트리거/RLS 정책에서도 참조 없음
--
-- ⚠️ 실행 전 필수 체크
--   1) 전체 DB 백업(또는 Supabase 브랜치/스냅샷) 확보
--   2) 모바일 등 이 repo 밖 클라이언트가 아래 함수를 호출하지 않는지 확인
--   3) 아래 "사전 검증 쿼리"로 참조 0건 재확인
--   4) DROP 은 되돌리기 어려움 — 반드시 트랜잭션 범위 내에서 확인 후 COMMIT
--
-- 제외 대상(의도적으로 남김):
--   - crew_member_exits : 살아있는 admin/crew-exits 페이지가 아직 조회 중.
--                         페이지를 status_logs(v3) 기준으로 이전한 뒤 별도 정리.
--   - is_crew_member    : 코드 직접호출은 없으나 다수 RLS 정책이 사용 → 유지 필수.
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- 사전 검증 쿼리 (BEGIN 전에 따로 실행해서 결과가 비어있는지 확인 권장)
-- ────────────────────────────────────────────────────────────────────────────
-- 1) 삭제 대상 함수가 다른 함수 본문에서 참조되는지:
--    select proname from pg_proc
--    where pronamespace='public'::regnamespace
--      and prosrc ~* '(accept_invite|claim_membership_by_code_and_nickname|get_crew_rank_month|get_crew_rank_total)';
--
-- 2) 삭제 대상 테이블/뷰에 최근 데이터가 있는지(있어도 사장 데이터일 수 있음):
--    select 'exits' t, count(*) from public.exits
--    union all select 'holds', count(*) from public.holds
--    union all select 'crew_member_actions', count(*) from public.crew_member_actions
--    union all select 'crew_invites', count(*) from public.crew_invites;


begin;

-- ── 1. 죽은 함수 (사장/대체됨) ──────────────────────────────────────────────
-- 초대코드 수락 흐름(미구현 기능)
drop function if exists public.accept_invite(uuid);

-- 초기 가입 방식 → request_join_crew(신청→승인)로 대체
drop function if exists public.claim_membership_by_code_and_nickname(text, text);

-- 랭킹 구버전 → get_crew_stats_month_rank / get_crew_stats_total_rank 로 대체
drop function if exists public.get_crew_rank_month(uuid, date);
drop function if exists public.get_crew_rank_total(uuid);


-- ── 2. 오버로드 중 죽은 시그니처만 제거 ─────────────────────────────────────
-- events 에 title/start_time 컬럼이 없어 호출 시 깨지는 오버로드
drop function if exists public.create_event_and_attendances(
  uuid, date, text, time without time zone, uuid[]
);

-- set_member_status 3-arg(직접 update) → 4-arg(change_member_state 경유)만 사용됨
drop function if exists public.set_member_status(uuid, text, text);

-- remove_member_with_log 3-arg(crew_member_exits 하드삭제) → 4-arg(soft, status_logs)만 사용됨
-- ⚠️ 이 함수가 crew_member_exits 에 쓰던 유일한 경로. 함께 정리하려면
--    crew_member_exits 및 get_crew_exits_admin, admin/crew-exits 페이지도 이전 필요.
drop function if exists public.remove_member_with_log(uuid, text, text);


-- ── 3. 죽은 테이블 (참조 함수/코드 없음, RLS 정책은 테이블과 함께 자동 삭제) ──
drop table if exists public.exits;                 -- crew_member_exits 의 구버전
drop table if exists public.holds;                 -- hold 는 memberships.status/note 로 대체
drop table if exists public.crew_member_actions;   -- crew_membership_status_logs 의 구버전

-- 초대 기능 세트 (accept_invite 제거 후 테이블도 정리)
drop table if exists public.crew_invites;


-- ── 4. 죽은 뷰 ──────────────────────────────────────────────────────────────
drop view if exists public.v_member_stats;         -- 코드/함수 어디서도 미참조


-- 확인 후 아래 주석 해제하여 확정:
-- commit;
rollback;   -- 기본은 rollback: 사전 검증 없이 실수로 실행돼도 안전
