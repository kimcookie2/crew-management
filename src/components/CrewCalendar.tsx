"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";

type DaySummary = { event_date: string; event_count: number };
type EventRow = {
  event_id: string;
  event_date: string;
  gym_name: string | null;
  attendee_count: number;
  attendee_names: string[]; 
};

function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function CrewCalendar({ crewId }: { crewId: string }) {
  const sb = supabaseBrowser();

  const [month, setMonth] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [selected, setSelected] = useState(() => ymd(new Date()));
  const [summary, setSummary] = useState<DaySummary[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const monthStr = useMemo(() => ymd(month), [month]);

  const summaryMap = useMemo(() => {
    const m = new Map<string, number>();
    summary.forEach((s) => m.set(s.event_date, s.event_count));
    return m;
  }, [summary]);

  function openSheet() {
    setSheetOpen(true);               // 먼저 마운트
    requestAnimationFrame(() => {
      setSheetVisible(true);          // 다음 프레임에 visible => 올라오는 애니메이션
    });
  }

  function closeSheet() {
    setSheetVisible(false);           // 내려가는 애니메이션 시작
    window.setTimeout(() => {
      setSheetOpen(false);            // 애니메이션 끝나고 언마운트
    }, 220); // transition 시간과 맞춰줘
  }

  useEffect(() => {
    (async () => {
      const { data, error } = await sb.rpc("is_crew_admin", { p_crew_id: crewId });
      if (!error) setIsAdmin(!!data);
    })();
  }, [crewId]);

  useEffect(() => {
    (async () => {
      setErr(null);
      const { data, error } = await sb.rpc("get_crew_month_event_summary", {
        p_crew_id: crewId,
        p_month: monthStr,
      });
      if (error) return setErr(error.message);
      setSummary((data ?? []) as DaySummary[]);
    })();
  }, [crewId, monthStr]);

  useEffect(() => {
    (async () => {
      setErr(null);
      const { data, error } = await sb.rpc("get_crew_events_by_date", {
        p_crew_id: crewId,
        p_event_date: selected,
      });
      if (error) return setErr(error.message);
      setEvents((data ?? []) as EventRow[]);
    })();
  }, [crewId, selected]);

  // ✅ days 생성: 7열 × (5~6행) "고정 틀" 만들기
  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const startDay = first.getDay(); // 0(일)~6
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();

    // 이번 달이 실제로 몇 주(행) 필요한지 계산
    const weeksNeeded = Math.ceil((startDay + daysInMonth) / 7);

    // ✅ 기본은 5줄, 필요하면 6줄(6주 달 대응)
    const rows = Math.min(6, Math.max(5, weeksNeeded));
    const total = rows * 7;

    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - startDay);

    return Array.from({ length: total }, (_, i) => {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      return d;
    });
  }, [month]);

  function goMonth(delta: number) {
    setMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  }

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (!touchStart.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    touchStart.current = null;

    // 상/하 스와이프가 좌/우보다 크면 월 이동
    if (Math.abs(dy) > 50 && Math.abs(dy) > Math.abs(dx)) {
      // 위로 스와이프 => 다음달, 아래 => 이전달 (원하면 반대로 바꿔줄게)
      if (dy < 0) goMonth(1);
      else goMonth(-1);
    }
  }

  const title = `${month.getFullYear()}년 ${month.getMonth() + 1}월`;

  return (
    <div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
        <button style={btn} onClick={() => goMonth(-1)}>←</button>
        <div style={{ fontWeight: 800, color: "black" }}>{title}</div>
        <button style={btn} onClick={() => goMonth(1)}>→</button>

        <div style={{ marginLeft: "auto" }}>
          <Link href={`/${crewId}/events/new`} style={{ ...btn, textDecoration: "none", display: "inline-block" }}>
            + 모임등록
          </Link>
        </div>
      </div>

      {err && <div style={{ color: "crimson", marginBottom: 8 }}>{err}</div>}

      <div
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        style={calendarFrame}
      >
        <div style={dowGrid}>
          {["일","월","화","수","목","금","토"].map((w) => (
            <div key={w} style={dowCell}>
              {w}
            </div>
          ))}
        </div>

        <div style={dayGrid}>
          {days.map((d) => {
            const inMonth = d.getMonth() === month.getMonth();
            const key = ymd(d);
            const cnt = summaryMap.get(key) ?? 0;
            const isSelected = key === selected;

            return (
              <div key={key} style={{ ...dayWrap, opacity: inMonth ? 1 : 0.25 }}>
                {/* ✅ 날짜: 정사각형 "바깥 위" */}
                <div style={outerDateLabel}>{d.getDate()}</div>

                {/* ✅ 정사각형 타일: 안에는 카운트/색칠만 */}
                <button
                  onClick={() => {
                    setSelected(key);
                    openSheet();
                  }}
                  style={{
                    ...dayTile,
                    background: isSelected ? "#DBEAFE" : cnt > 0 ? "#E9FBEF" : "#FFFFFF",
                    borderColor: isSelected ? "#60A5FA" : "#E5E7EB",
                  }}
                  aria-label={`${key} 일정 ${cnt}개`}
                >
                  {cnt > 0 && <span style={countBadge}>{cnt}</span>}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {sheetOpen && (
        <div style={{ ...backdrop, ...(sheetVisible ? backdropIn : backdropOut) }}
            onClick={closeSheet}
            role="presentation"
        >
          <div
            style={{ ...sheet, ...(sheetVisible ? sheetIn : sheetOut) }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div style={sheetHandleWrap}>
              <div style={sheetHandle} />
            </div>

            <div style={sheetHeader}>
              <div style={{ fontWeight: 900, color: "black" }}>
                {selected} 일정 ({events.length})
              </div>
              <button style={sheetCloseBtn} onClick={closeSheet}>
                닫기
              </button>
            </div>

            <div style={sheetBody}>
              {events.map((ev) => (
                <>
                  {isAdmin ? (
                    <Link
                      key={ev.event_id}
                      href={`/${crewId}/events/${ev.event_id}`}
                      style={sheetItem}
                      onClick={closeSheet}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <strong>{ev.gym_name ?? "(장소 없음)"}</strong>
                        <span style={{ fontSize: 12, opacity: 0.75 }}>참석 {ev.attendee_count}명</span>
                      </div>

                      {/* ✅ 참석 명단 */}
                      <div style={{ fontSize: 12, opacity: 0.8, marginTop: 6, lineHeight: "16px" }}>
                        {ev.attendee_names?.length ? ev.attendee_names.join(", ") : "참석자 없음"}
                      </div>
                    </Link>
                  ) : (
                    <div key={ev.event_id} style={{ ...sheetItem, cursor: "default", background: "#f8fafc" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <strong>{ev.gym_name ?? "(장소 없음)"}</strong>
                        <span style={{ fontSize: 12, opacity: 0.75 }}>참석 {ev.attendee_count}명</span>
                      </div>

                      {/* ✅ 참석 명단 */}
                      <div style={{ fontSize: 12, opacity: 0.8, marginTop: 6, lineHeight: "16px" }}>
                        {ev.attendee_names?.length ? ev.attendee_names.join(", ") : "참석자 없음"}
                      </div>
                    </div>
                  )}
                </>
              ))}

              {events.length === 0 && (
                <div style={{ fontSize: 13, opacity: 0.75 }}>
                  이 날짜에는 일정이 없습니다.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const btn: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  background: "white",
  cursor: "pointer",
  color: "black",
};

const cellBase: React.CSSProperties = {
  boxSizing: "border-box",
  width: "100%",
  minWidth: 0, 
};

const dowCell: React.CSSProperties = {
  ...cellBase,
  textAlign: "center",
  fontSize: 12,
  padding: "8px 0",
  fontWeight: 800,
  opacity: 0.8,
};

const calendarFrame: React.CSSProperties = {
  padding: 0,
  background: "white",
};

const dowGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
  gap: 10,
  marginBottom: 10,
};

const dowCell2: React.CSSProperties = {
  textAlign: "center",
  fontSize: 12,
  fontWeight: 800,
  opacity: 0.7,
  color: "black",
};

const dayGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
  gap: 10, // ✅ 일정한 간격으로 틀 고정 느낌
};

const dateLabel: React.CSSProperties = {
  position: "absolute",
  top: 6,
  left: 8,
  fontSize: 11,
  fontWeight: 800,
  opacity: 0.85,
};

const dayWrap: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,          // 날짜와 타일 사이 간격
  minWidth: 0,
};

const outerDateLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  color: "black",
  opacity: 0.85,
  lineHeight: "12px",
  textAlign: "center", 
  paddingLeft: 2,
};

const dayTile: React.CSSProperties = {
  position: "relative",
  border: "1px solid #E5E7EB",
  borderRadius: 14,
  aspectRatio: "1 / 1", // ✅ 정사각 유지
  width: "100%",
  padding: 8,
  cursor: "pointer",
  overflow: "hidden",
};

const countBadge: React.CSSProperties = {
  position: "absolute",
  right: 8,
  bottom: 8,
  minWidth: 20,
  height: 20,
  padding: "0 6px",
  fontSize: 12,
  fontWeight: 800,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const backdrop: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  display: "flex",
  justifyContent: "center",
  alignItems: "flex-end",
  zIndex: 50,
  transition: "background 220ms ease",
};

const backdropIn: React.CSSProperties = {
  background: "rgba(0,0,0,0.35)",
};

const backdropOut: React.CSSProperties = {
  background: "rgba(0,0,0,0)",
};

const sheet: React.CSSProperties = {
  width: "100%",
  maxWidth: 520,
  background: "white",
  borderTopLeftRadius: 18,
  borderTopRightRadius: 18,
  padding: "10px 14px 16px",
  boxShadow: "0 -12px 30px rgba(0,0,0,0.15)",
  maxHeight: "75vh",
  overflow: "hidden",
  transition: "transform 220ms ease, opacity 220ms ease",
  willChange: "transform, opacity",
};

const sheetHandleWrap: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  padding: "4px 0 10px",
};

const sheetHandle: React.CSSProperties = {
  width: 44,
  height: 5,
  borderRadius: 999,
  background: "#E5E7EB",
};

const sheetHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  marginBottom: 10,
};

const sheetCloseBtn: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 10,
  border: "1px solid #E5E7EB",
  background: "white",
  cursor: "pointer",
  color: "black",
  fontWeight: 800,
};

const sheetBody: React.CSSProperties = {
  overflowY: "auto",
  maxHeight: "calc(75vh - 70px)",
  display: "grid",
  gap: 8,
  paddingRight: 2,
};

const sheetItem: React.CSSProperties = {
  display: "block",
  border: "1px solid #E5E7EB",
  borderRadius: 12,
  padding: 12,
  textDecoration: "none",
  color: "black",
};

const sheetIn: React.CSSProperties = {
  transform: "translateY(0px)",
  opacity: 1,
};

const sheetOut: React.CSSProperties = {
  transform: "translateY(24px)", // 내려가며 사라짐
  opacity: 0,
};