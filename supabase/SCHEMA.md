# Supabase 실제 스키마 (introspection 덤프)

> 프로젝트 ref: `knvsonxgbeglatfnumby` · schema: `public`
> `information_schema` / `pg_policies` / `pg_proc` 조회 결과로 재구성한 문서.
>
> **2026-07-28 정리 완료** — 죽은 객체 삭제됨 (`migrations/20260728000000_drop_dead_objects.sql`):
> 테이블 `exits`·`holds`·`crew_member_actions`·`crew_invites`, 뷰 `v_member_stats`,
> 함수 `accept_invite`·`claim_membership_by_code_and_nickname`·`get_crew_rank_month`·`get_crew_rank_total`
> 및 깨진 오버로드(`create_event_and_attendances(title/start_time)`, `set_member_status/3-arg`, `remove_member_with_log/3-arg`).
>
> **2026-07-28 암장 카탈로그 도입** (`migrations/20260728010000_gym_catalog.sql`):
> 테이블 `gyms`(브랜드)·`gym_branches`(지점) 추가, `events`에 `gym_id`·`branch_id` 추가.
> 기존 `events.gym_name`(text)은 레거시 표시용으로 보존. 이벤트 RPC(`create_event_and_attendances`,
> `update_event`, `get_crew_events_by_date`)를 gym_id/branch_id 기반으로 교체.
>
> **2026-07-28 레거시 암장 정리** (`gym-remap/3_apply_remap.sql`): 텍스트로 남아있던 이벤트 61건을
> 카탈로그로 일괄 재매핑. 신규 브랜드 13개·지점 다수 추가. 비암장 4건(임시/송년회/신년회/합동정모)은 텍스트 유지.

## 정체성(Identity) 모델 — 3단계

```
auth.users (Supabase Auth)
    │ 1:1
    ▼
profiles ──person_id──▶ people ◀──person_id── crew_memberships
 (id = auth.uid)      (사람 원장)              (크루 내 멤버)
                          ▲                         │
                          └── auth_user_id ─────────┘ (denormalized user_id)
```

- **`people`** — 사람의 canonical 레코드. 로그인 계정과 무관하게 먼저 존재할 수 있음(관리자가 닉네임만으로 멤버 선등록). 나중에 `auth_user_id`로 실제 계정과 연결(claim).
- **`profiles`** — `auth.users`와 1:1 (`id = auth.uid()`). 신규 가입 시 `handle_new_user` 트리거가 자동 생성. `person_id`로 people과 연결.
- **`crew_memberships`** — 특정 크루 안의 멤버. `person_id`(필수) + `user_id`(계정 연결 시 채워지는 중복 컬럼) 둘 다 보유.

가입 흐름: 관리자가 닉네임으로 멤버 선등록 → 사용자가 `join_code`+닉네임으로 `request_join_crew` → 관리자 `approve_join_request` → people.auth_user_id 연결 + membership.user_id 채움 + status active.

## 현재 운영 모델 (살아있는 흐름만)

> 실제로 데이터가 쌓이고 조회되는 경로만 정리. (죽은 객체는 2026-07-28 삭제 완료.)
> `crew_member_exits`는 남아있으나 신규 데이터가 안 쌓이는 semi-dead 상태 — 아래 참고.

### 멤버 상태 관리 — 단일 컬럼 + 이력 로그

상태의 진실은 `crew_memberships.status` **한 컬럼**. 바뀔 때마다 `crew_membership_status_logs`에 기록.

| status | 의미 | 노출 |
|---|---|---|
| `active` | 정상 활동 | 대시보드/통계 |
| `hold` | 일시정지 (사유는 note) | 대시보드/통계 (remain_days 제외) |
| `inactive` | 비활성 | 숨김(crew-hidden) |
| `left` | 자발적 탈퇴 | 숨김 |
| `kicked` | 강제 탈퇴 | 숨김 |
| `dropped` | 드랍 | 숨김 |

상태 변경은 전부 `change_member_state()` 하나를 경유 (admin 체크 → status 갱신 → 로그 기록):

```
set_member_status('hold'/'active')   ┐
set_member_inactive()                 ├──▶ change_member_state()
remove_member_with_log(4-arg)         │      ├ crew_memberships.status 갱신
restore_member_active()               ┘      └ crew_membership_status_logs 기록
```

- 대시보드/통계 노출 대상 = `status in ('active','hold')`.
- crew-hidden 페이지 = inactive/left/kicked/dropped + status_logs 최신 로그(사유·날짜).
- **탈퇴는 행 삭제가 아닌 soft** — status만 바뀌고 이력이 남아 `restore_member_active`로 복구 가능.

### 참석 현황 관리 — events + attendances + "2명 규칙"

```
events (모임 1건: crew_id, event_date, gym_id→gyms, branch_id→gym_branches)
   └─1:N─▶ attendances (event_id, membership_id)  UNIQUE(event_id, membership_id)
```
암장은 카탈로그(`gyms`→`gym_branches`)에서 선택. `is_active=false`(미사용)는 일정등록 선택지에서 제외되지만 기존 이벤트 기록·표시는 유지.

- 참석자 편집: `set_event_attendees()`가 "선택 목록 = 최종 상태"로 동기화(빠진 사람 delete + 추가 insert).
- **집계 규칙 (`get_crew_dashboard`):**
  1. 참석자 **2명 이상**인 모임만 출석 인정 (`attendee_count >= 2`).
  2. 멤버 출석 수 = 유효 모임 날짜의 distinct 개수 + `legacy_attendance_count`(이월분).
  3. `keep_days`: 총출석 100+ → 100, <20 → 30, <30 → 35, 그 외 40.
  4. `remain_days`: hold→null / 미출석→`14-(오늘-가입일)` / 그 외→`keep_days-(오늘-마지막출석)`, 최소 0.
  5. 랭킹은 `dense_rank()`로 총출석·월출석 순위 산출.

### 한 장 요약

| 관심사 | 저장 위치 | 변경 경로 | 조회 |
|---|---|---|---|
| 멤버 상태 | `crew_memberships.status` | `change_member_state()` | active/hold→대시보드, 그외→crew-hidden |
| 상태 이력 | `crew_membership_status_logs` | 상태 변경 시 자동 | crew-hidden 사유·날짜 |
| 모임 | `events` | admin 생성/수정/삭제 | 캘린더·대시보드 |
| 참석 | `attendances` | `set_event_attendees()` | 2명+ 모임만 집계 |
| 출석 총계 | 계산값(+legacy) | 실시간 집계 | `get_crew_dashboard` |

## 테이블 (11)

> `crews`, `people`, `profiles`, `crew_memberships`, `events`, `attendances`, `crew_join_requests`, `crew_membership_status_logs`, `crew_member_exits`, `gyms`, `gym_branches`.

### 핵심 도메인

#### `crews` — 크루
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid PK | gen_random_uuid() |
| name | text NOT NULL | |
| slug | text | UNIQUE |
| join_code | text | 가입 코드 (닉네임 매칭용) |
| created_by | uuid | auth.users |
| created_at | timestamptz | now() |

#### `people` — 사람 원장
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid PK | |
| display_name | text NOT NULL | |
| auth_user_id | uuid | 계정 연결 (null=미연결) |
| created_at | timestamptz | now() |

#### `profiles` — 계정 프로필 (auth 1:1)
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid PK | = auth.uid() |
| person_id | uuid → people.id | |
| display_name | text | |
| created_at | timestamptz | now() |

#### `crew_memberships` — 크루 멤버십 (핵심)
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid PK | |
| crew_id | uuid → crews.id | UNIQUE(crew_id, person_id) |
| person_id | uuid → people.id | |
| user_id | uuid | 계정 연결 시 채워지는 중복 컬럼 |
| role | text NOT NULL | 'member' / 'admin' |
| status | text NOT NULL | 'active' / 'hold' / 'inactive' / 'left' / 'kicked' / 'dropped' (+ 코드상 'exited') |
| display_name | text | |
| joined_at | date | |
| legacy_attendance_count | bigint NOT NULL | 이전 시스템 출석 수 이월분 (총계에 합산) |
| note | text | hold 사유 / 대시보드 표시 노트 |
| created_at | timestamptz | now() |

#### `events` — 모임(이벤트)
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid PK | |
| crew_id | uuid → crews.id | |
| event_date | date NOT NULL | |
| gym_id | uuid → gyms.id | 암장(브랜드). 신규 이벤트 필수 |
| branch_id | uuid → gym_branches.id | 지점. 지점 있는 암장이면 필수 |
| gym_name | text | 레거시 텍스트(신규 미사용, 과거 이벤트 표시 fallback) |
| memo | text | |
| created_by | uuid | |
| created_at | timestamptz | now() |

#### `attendances` — 출석
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid PK | |
| event_id | uuid → events.id | UNIQUE(event_id, membership_id) |
| membership_id | uuid → crew_memberships.id | |
| created_by | uuid | |
| created_at | timestamptz | now() |

### 암장 카탈로그 (전역 공유)

#### `gyms` — 암장 브랜드
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid PK | |
| name | text NOT NULL | UNIQUE (더클라임 / 서울숲 / 클라이밍파크 …) |
| is_active | boolean NOT NULL | 기본 true. false=미사용(일정등록 드롭다운에서 숨김, 기록 유지) |
| created_by / created_at | uuid / timestamptz | |

#### `gym_branches` — 지점
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid PK | |
| gym_id | uuid → gyms.id | ON DELETE CASCADE. UNIQUE(gym_id, name) |
| name | text NOT NULL | 신림 / 종로 / 연남 … |
| is_active | boolean NOT NULL | 기본 true. false=미사용 |
| created_by / created_at | uuid / timestamptz | |

- **원뎁스 암장**(볼더생활·오프더월·훅클라임): `gym_branches` row 없음 → 이벤트는 `gym_id`만.
- **투뎁스 암장**(더클라임·서울숲·클라이밍파크): 지점 등록 → 이벤트는 `gym_id` + `branch_id`.
- 관리: `is_crew_admin`이 아니라 **`is_any_crew_admin()`**(아무 크루 admin) 헬퍼로 게이팅. 쓰기는 전부 RPC(`admin_add_gym`, `admin_add_gym_branch`, `admin_set_gym_active`, `admin_set_gym_branch_active`) 경유, 직접 쓰기는 RLS 차단.

### 가입

#### `crew_join_requests` — 가입 신청
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid PK | |
| crew_id | uuid → crews.id | |
| person_id | uuid → people.id | |
| auth_user_id | uuid NOT NULL | |
| nickname | text NOT NULL | |
| status | text NOT NULL | 'pending' / 'approved' / 'rejected' |
| reason | text | 거절 사유 |
| decided_at / decided_by | tstz / uuid | |
| created_at | timestamptz | now() |

### 상태 변경/이탈 이력

#### `crew_membership_status_logs` — 상태 변경 로그 (현재 활성 경로)
| 컬럼 | 타입 |
|---|---|
| id uuid PK · crew_id → crews · membership_id → crew_memberships |
| display_name_snapshot text NOT NULL · from_status · to_status NOT NULL |
| effective_date date · reason · actor_id · created_at |

- `change_member_state` / `set_member_*` / `restore_member_active` / `remove_member_with_log`(4-arg) 가 기록.
- `get_crew_hidden_members_admin`가 이 로그의 최신값으로 "숨김(inactive/left/kicked/dropped)" 멤버 표시.

#### `crew_member_exits` — 이탈 스냅샷 (⚠️ semi-dead)
| 컬럼 | 타입 |
|---|---|
| id uuid PK · crew_id → crews · display_name NOT NULL · joined_at |
| exited_at tstz · exit_type text NOT NULL · reason · decided_by · created_at |

- `get_crew_exits_admin` → admin/crew-exits 페이지가 **읽지만**, 여기에 쓰던 유일 경로(`remove_member_with_log` 3-arg)가 삭제돼 **신규 데이터는 더 이상 안 쌓임**. 과거 하드삭제 시절 데이터만 잔존.
- 정리하려면 crew-exits 페이지를 status_logs(v3) 기준으로 이전 후 테이블/함수 함께 제거.

## RLS 정책 요약

모든 정책은 `{authenticated}` 롤 대상. 두 헬퍼로 게이팅:
- `is_crew_member(crew_id)` — 해당 크루 멤버(status ≠ exited)면 true
- `is_crew_admin(crew_id)` — role='admin' 이고 status ≠ exited 면 true

| 테이블 | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| crews | member | 본인(created_by) | admin | — |
| crew_memberships | member | admin | admin | admin |
| events | member | admin | admin | admin |
| attendances | member(이벤트경유) | admin | — | admin |
| crew_join_requests | 본인 or admin | 본인 | admin | — |
| people | 전체 authenticated(true) | — | — | — |
| profiles | 본인 | — | 본인 | — |
| gyms / gym_branches | 전체 authenticated(true) | RPC만 | RPC만 | — |

> `people`은 로그인 사용자면 전부 SELECT 가능(닉네임 매칭 위해). 나머지 쓰기는 대부분 SECURITY DEFINER RPC로만 수행되고, 직접 테이블 쓰기는 RLS로 막힘.
> (삭제된 `crew_invites` / `holds` / `exits`의 RLS 정책도 테이블과 함께 제거됨.)

## 핵심 비즈니스 로직 (get_crew_dashboard 기준)

- **유효 이벤트**: 참석자 **2명 이상**인 이벤트만 출석으로 카운트(`attendee_count >= 2`).
- **출석 집계**: 멤버별 "유효 이벤트가 있던 날짜"의 distinct count + `legacy_attendance_count`.
- **keep_days**(연속 유지 허용일): 총출석 100+ → 100, <20 → 30, <30 → 35, 그 외 → 40.
- **remain_days**: hold면 null / 미출석이면 `14 - (오늘-가입일)` / 그 외 `keep_days - (오늘-마지막출석)`, 최소 0.
- **랭킹**: `dense_rank`로 total_rank / month_rank 산출. 통계 화면은 전월 대비 rank_delta 제공.

## 참고 사항 / 남은 정리 후보

1. ✅ **완료(2026-07-28)** — 중복 세대 테이블(`exits`·`holds`·`crew_member_actions`), 미사용 함수/오버로드, `crew_invites` 세트, `v_member_stats` 뷰 삭제.
2. **`crew_member_exits` + crew-exits 페이지** — semi-dead. 페이지를 status_logs 기준으로 이전 후 테이블/`get_crew_exits_admin` 정리 남음.
3. `crew_memberships.user_id`는 `people.auth_user_id`와 중복 저장(denormalization) — 의도된 최적화.
4. 이제 `supabase/migrations/`에 마이그레이션 도입 시작됨 — 향후 스키마 변경은 여기에 파일로 기록 권장.
