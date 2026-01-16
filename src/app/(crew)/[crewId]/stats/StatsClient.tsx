"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type TotalRow = {
  membership_id: string;
  display_name: string;
  role: string | null;
  status: string | null;
  total_attendances: number;
  total_rank: number;
};

type MonthRow = {
  membership_id: string;
  display_name: string;
  role: string | null;
  status: string | null;
  month_count: number;
  month_rank: number;
  prev_count: number;
  prev_rank: number | null;
  rank_delta: number | null;
};

type Tab = "total" | "month";

function ymdToday() {
  return new Date().toISOString().slice(0, 10);
}
function monthStartFromYmd(ymd: string) {
  return `${ymd.slice(0, 7)}-01`;
}
function monthStartFromYm(ym: string) {
  // ym: "2026-01"
  return `${ym}-01`;
}
function fmtYM(monthStart: string) {
  const d = new Date(`${monthStart}T00:00:00`);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
}
function diffBadge(curr: number, prev: number) {
  const d = (curr ?? 0) - (prev ?? 0);
  if (d > 0) return `▲${d}`;
  if (d < 0) return `▼${Math.abs(d)}`;
  return "-";
}

export default function StatsClient({ crewId }: { crewId: string }) {
  const sb = supabaseBrowser();

  const [tab, setTab] = useState<Tab>("total");

  // ✅ 기준일(컷) - 대시보드랑 통일
  const [asof, setAsof] = useState(ymdToday());

  // ✅ 월 선택(월 탭에서만)
  const [ym, setYm] = useState(() => ymdToday().slice(0, 7)); // "YYYY-MM"

  const [totalRows, setTotalRows] = useState<TotalRow[]>([]);
  const [monthRows, setMonthRows] = useState<MonthRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const monthStart = useMemo(() => monthStartFromYm(ym), [ym]);

  async function loadTotal() {
    console.log("loadTotal")
    setLoading(true);
    setErr(null);
    const { data, error } = await sb.rpc("get_crew_stats_total_rank", {
      p_crew_id: crewId,
      p_asof: asof,
    });
    setLoading(false);
    if (error) return setErr(error.message);
    setTotalRows((data ?? []) as TotalRow[]);
  }

  async function loadMonth() {
    console.log("loadMonth")
    setLoading(true);
    setErr(null);
    const { data, error } = await sb.rpc("get_crew_stats_month_rank", {
      p_crew_id: crewId,
      p_month: monthStart,
      p_asof: asof,
    });
    setLoading(false);
    if (error) return setErr(error.message);
    setMonthRows((data ?? []) as MonthRow[]);
  }

  function rankDeltaLabel(prevRank: number | null, delta: number | null) {
    if (prevRank == null) return { text: "-", color: "#6B7280" }; // 회색
    if (delta == null || delta === 0) return { text: "-", color: "#6B7280" };
    if (delta > 0) return { text: `▲${delta}`, color: "#EF4444" }; // 상승=빨강
    return { text: `▼${Math.abs(delta)}`, color: "#3B82F6" }; // 하락=파랑
  }

  // 탭/기준일/월 변경에 따라 로드
  useEffect(() => {
    if (tab === "total") loadTotal();
    else loadMonth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, asof, monthStart, crewId]);

  return (
    <div style={{ color: "black" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setTab("total")}
            style={{ ...tabBtn, ...(tab === "total" ? tabBtnOn : tabBtnOff) }}
          >
            전체
          </button>
          <button
            onClick={() => setTab("month")}
            style={{ ...tabBtn, ...(tab === "month" ? tabBtnOn : tabBtnOff) }}
          >
            월별
          </button>
        </div>

        {tab === "month" && (
          <div style={{  }}>
            <input
              type="month"
              value={ym}
              onChange={(e) => setYm(e.target.value)}
              style={input}
            />
          </div>
        )}
        <div style={{ flex: 1 }} />
      </div>

      

      {err && <div style={{ color: "crimson", marginBottom: 10 }}>{err}</div>}

      <div style={{ position: "relative" }}>
        {loading && (
          <div style={overlay}>
            <div style={spinnerBox}>
              <div style={spinner} />
              <div style={{ fontSize: 12, marginTop: 8, fontWeight: 800 }}>불러오는 중...</div>
            </div>
          </div>
        )}

        {tab === "total" ? (
          <div style={card}>
            <div style={cardTitle}>전체 활동참여 기준 순위</div>
            <table style={table}>
              <thead>
                <tr style={theadTr}>
                  <th style={th}>순위</th>
                  <th style={th}>닉네임</th>
                  <th style={th}>총 참여</th>
                </tr>
              </thead>
              <tbody>
                {totalRows.map((r) => {
                  const isHold = r.status && r.status !== "active";
                  return (
                    <tr key={r.membership_id} style={{ background: isHold ? "white" : "white" }}>
                      <td style={tdCenter}>{r.total_rank}</td>
                      <td style={tdCenter}>
                        <span style={{ color: "#FF00FF" }}>{r.role === "admin" ? "★" : ""}</span>
                        {r.display_name}
                      </td>
                      <td style={tdCenter}>{r.total_attendances ?? 0}</td>
                    </tr>
                  );
                })}
                {totalRows.length === 0 && (
                  <tr><td colSpan={4} style={{ ...tdCenter, padding: 14, opacity: 0.7 }}>데이터가 없습니다.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={card}>
            <div style={cardTitle}>월별 참여 순위 · {fmtYM(monthStart)}</div>
            <table style={table}>
              <thead>
                <tr style={theadTr}>
                  <th style={th}>순위</th>
                  <th style={th}>닉네임</th>
                  <th style={th}>이번달</th>
                  <th style={th}>전월</th>
                  <th style={th}>변동</th>
                </tr>
              </thead>
              <tbody>
                {monthRows.map((r) => {
                  const isHold = r.status && r.status !== "active";
                  const mv = rankDeltaLabel(r.prev_rank, r.rank_delta);

                  return (
                    <tr key={r.membership_id} style={{ background: isHold ? "white" : "white" }}>
                      <td style={tdCenter}>{r.month_rank}</td>
                      <td style={tdCenter}>
                        <span style={{ color: "#FF00FF" }}>{r.role === "admin" ? "★" : ""}</span>
                        {r.display_name}
                      </td>
                      <td style={tdCenter}>{r.month_count ?? 0}</td>
                      <td style={tdCenter}>{r.prev_count ?? 0}</td>
                      <td style={{ ...tdCenter, fontWeight: 900, color: mv.color }}>{mv.text}</td>
                    </tr>
                  );
                })}
                {monthRows.length === 0 && (
                  <tr><td colSpan={6} style={{ ...tdCenter, padding: 14, opacity: 0.7 }}>데이터가 없습니다.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* styles */
const tabBtn: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 999,
  border: "1px solid #cbd5e1",
  fontWeight: 900,
  cursor: "pointer",
};
const tabBtnOn: React.CSSProperties = { background: "#111827", color: "white", borderColor: "#111827" };
const tabBtnOff: React.CSSProperties = { background: "white", color: "black" };

const input: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  background: "white",
  color: "black",
};

const card: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  padding: 12,
  background: "white",
};

const cardTitle: React.CSSProperties = {
  fontWeight: 900,
  marginBottom: 10,
};

const table: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 13,
};

const theadTr: React.CSSProperties = {
  background: "#002060",
  color: "white",
};

const th: React.CSSProperties = {
  padding: "10px 8px",
  textAlign: "center",
  borderRight: "1px solid black",
  whiteSpace: "nowrap",
};

const tdCenter: React.CSSProperties = {
  padding: "8px 8px",
  textAlign: "center",
  borderTop: "1px solid #e5e7eb",
  whiteSpace: "nowrap",
  color: "black",
};

const tdLeft: React.CSSProperties = {
  ...tdCenter,
  textAlign: "left",
};

const overlay: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  background: "rgba(255,255,255,0.6)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 14,
  zIndex: 20,
};

const spinnerBox: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  padding: 14,
  borderRadius: 14,
  background: "white",
  border: "1px solid #e5e7eb",
};

const spinner: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 999,
  border: "3px solid #cbd5e1",
  borderTopColor: "#111827",
  animation: "spin 0.9s linear infinite",
};
