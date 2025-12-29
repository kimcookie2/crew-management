"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";

type DaySummary = { event_date: string; event_count: number };
type EventRow = { event_id: string; event_date: string; gym_name: string | null; attendee_count: number };

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

  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const monthStr = useMemo(() => ymd(month), [month]);

  const summaryMap = useMemo(() => {
    const m = new Map<string, number>();
    summary.forEach((s) => m.set(s.event_date, s.event_count));
    return m;
  }, [summary]);

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

  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const startDay = first.getDay(); // 0(일)~6
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - startDay);

    const arr: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      arr.push(d);
    }
    return arr;
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
        style={{ border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", background: "#f1f5f9" }}>
          {["일","월","화","수","목","금","토"].map((w) => (
            <div key={w} style={{ padding: 8, textAlign: "center", fontSize: 12, fontWeight: 800 }}>
              {w}
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
          {days.map((d) => {
            const inMonth = d.getMonth() === month.getMonth();
            const key = ymd(d);
            const cnt = summaryMap.get(key) ?? 0;
            const isSelected = key === selected;

            return (
              <button
                key={key}
                onClick={() => setSelected(key)}
                style={{
                  border: "0",
                  borderTop: "1px solid #e2e8f0",
                  borderRight: "1px solid #e2e8f0",
                  background: isSelected ? "#dbeafe" : cnt > 0 ? "#eafff0" : "white",
                  padding: 10,
                  textAlign: "left",
                  cursor: "pointer",
                  minHeight: 56,
                  opacity: inMonth ? 1 : 0.35,
                  color: "black",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong style={{ fontSize: 13 }}>{d.getDate()}</strong>
                  {cnt > 0 && (
                    <span style={{ fontSize: 11, border: "1px solid #cbd5e1", borderRadius: 999, padding: "2px 6px" }}>
                      {cnt}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={{ fontWeight: 800, marginBottom: 8, color: "black" }}>
          {selected} 일정 목록 ({events.length})
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          {events.map((ev) => (
            <Link
              key={ev.event_id}
              href={`/${crewId}/events/${ev.event_id}`}
              style={{
                display: "block",
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                padding: 12,
                textDecoration: "none",
                color: "black",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <strong>{ev.gym_name ?? "(장소 없음)"}</strong>
                <span style={{ fontSize: 12, opacity: 0.75 }}>참석 {ev.attendee_count}명</span>
              </div>
              <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
                클릭해서 수정/삭제
              </div>
            </Link>
          ))}
          {events.length === 0 && (
            <div style={{ fontSize: 13, opacity: 0.75 }}>이 날짜에는 일정이 없습니다.</div>
          )}
        </div>
      </div>
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
