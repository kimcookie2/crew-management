"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type Row = {
  membership_id: string;
  display_name: string;
  joined_at: string | null;
  last_attended_date: string | null;
  status: string;
  role: string | null;
  note: string | null;
  total_attendances: number;
  total_rank: number;
  keep_days: number;
  remain_days: number | null;
  month_count: number;
  prev_count: number;
};

type Tab = "total" | "month";

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

function monthKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function denseRank(sortedValues: number[]) {
  // values는 이미 내림차순 정렬되어 있다고 가정
  const ranks: number[] = [];
  let last: number | null = null;
  let rank = 0;
  for (let i = 0; i < sortedValues.length; i++) {
    const v = sortedValues[i];
    if (last === null || v !== last) rank = rank + 1;
    ranks.push(rank);
    last = v;
  }
  return ranks;
}

export default function StatsClient({ crewId }: { crewId: string }) {
  const sb = supabaseBrowser();

  const [tab, setTab] = useState<Tab>("total");
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const pMonthDate = useMemo(() => `${month}-01`, [month]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);

      const { data, error } = await sb.rpc("get_crew_dashboard", {
        p_crew_id: crewId,
        p_month: pMonthDate,
      });

      setLoading(false);
      if (error) return setErr(error.message);
      setRows((data ?? []) as Row[]);
    })();
  }, [crewId, pMonthDate]);

  const view = useMemo(() => {
    if (tab === "total") {
      const sorted = [...rows].sort((a, b) => (b.total_attendances ?? 0) - (a.total_attendances ?? 0));
      const values = sorted.map((r) => r.total_attendances ?? 0);
      const ranks = denseRank(values);
      return sorted.map((r, i) => ({ ...r, _rank: ranks[i], _value: r.total_attendances ?? 0 }));
    } else {
      const sorted = [...rows].sort((a, b) => (b.month_count ?? 0) - (a.month_count ?? 0));
      const values = sorted.map((r) => r.month_count ?? 0);
      const ranks = denseRank(values);
      return sorted.map((r, i) => ({ ...r, _rank: ranks[i], _value: r.month_count ?? 0 }));
    }
  }, [rows, tab]);

  const title = tab === "total" ? "전체 활동참여 순위" : `${month} 월 참여 순위`;

  return (
    <div style={{ color: "black" }}>
      {/* 탭 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button onClick={() => setTab("total")} style={{ ...tabBtn, ...(tab === "total" ? tabOn : {}) }}>
          전체
        </button>
        <button onClick={() => setTab("month")} style={{ ...tabBtn, ...(tab === "month" ? tabOn : {}) }}>
          월별
        </button>

        <div style={{ flex: 1 }} />

        {/* 월 선택 (월별 탭일 때만) */}
        {tab === "month" && (
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            style={monthInput}
          />
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{ fontWeight: 900 }}>{title}</div>
        {loading && <span style={{ fontSize: 12, opacity: 0.75 }}>불러오는 중…</span>}
        {err && <span style={{ fontSize: 12, color: "crimson" }}>{err}</span>}
      </div>

      {/* 표 */}
      <div style={tableWrap}>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>순위</th>
              <th style={th}>닉네임</th>
              <th style={th}>{tab === "total" ? "총 참여횟수" : "이 달 참여횟수"}</th>
              {/* <th style={th}>전월</th>
              <th style={th}>상태</th> */}
            </tr>
          </thead>
          <tbody>
            {view.map((r) => (
              <tr key={r.membership_id} style={r.status === "hold" ? trHold : undefined}>
                <td style={td}>{r._rank}</td>
                <td style={td}>
                  <span style={{ fontWeight: 900 }}>
                    {r.role === "admin" ? "★" : ""}
                    {r.display_name}
                  </span>
                </td>
                <td style={td}>{r._value}</td>
                {/* <td style={td}>{r.prev_count ?? 0}</td>
                <td style={td}>{r.status === "hold" ? "정지" : "활동"}</td> */}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
        * 참여횟수는 “해당 이벤트 참석자 수가 2명 이상”일 때만 인정됩니다.
      </div>
    </div>
  );
}

const tabBtn: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 999,
  border: "1px solid #cbd5e1",
  background: "white",
  cursor: "pointer",
  fontWeight: 900,
  color: "black",
};

const tabOn: React.CSSProperties = {
  borderColor: "#111827",
  background: "#111827",
  color: "white",
};

const monthInput: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 12,
  border: "1px solid #cbd5e1",
  background: "white",
  color: "black",
};

const tableWrap: React.CSSProperties = {
  width: "100%",
  overflowX: "auto",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
};

const table: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: 400,
  background: "white",
};

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  borderBottom: "1px solid #e5e7eb",
  fontSize: 12,
  opacity: 0.85,
  whiteSpace: "nowrap",
};

const td: React.CSSProperties = {
  padding: "10px 12px",
  borderBottom: "1px solid #f1f5f9",
  fontSize: 14,
  whiteSpace: "nowrap",
};

const trHold: React.CSSProperties = {
  background: "#FEF3C7",
};
