-- ============================================================================
-- 마지막 접속(last_seen) 추적 (DRAFT)
-- ----------------------------------------------------------------------------
-- last_sign_in_at 은 실제 로그인 이벤트에만 갱신되고 토큰 자동갱신엔 안 잡히므로,
-- profiles.last_seen_at 을 앱 진입 시 직접 갱신. write 부하는 10분 쓰로틀로 최소화.
-- 확인은 DB에서 직접(별도 화면 없음).
-- ⚠️ 기본 rollback. 검증 후 commit.
-- ============================================================================

begin;

alter table public.profiles
  add column if not exists last_seen_at timestamptz;

-- 앱 진입 시 호출. 10분 이내면 no-op (한 사람당 최대 10분에 1 write).
create or replace function public.touch_last_seen()
returns void
language sql
security definer
set search_path to 'public'
as $$
  update public.profiles
  set last_seen_at = now()
  where id = auth.uid()
    and (last_seen_at is null or last_seen_at < now() - interval '10 minutes');
$$;

-- commit;
rollback;
