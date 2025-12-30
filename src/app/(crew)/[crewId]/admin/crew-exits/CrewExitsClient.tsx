"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Row = {
  id: string;
  display_name: string;
  joined_at: string | null;
  exited_at: string; // timestamptz
  exit_type: "leave" | "kick" | "drop" | string;
  reason: string | null;
};

function typeLabel(t: string) {
  if (t === "leave") return "퇴장";
  if (t === "kick") return "추방";
  if (t === "drop") return "이탈";
  return t;
}

function fmtDate(s: string | null) {
  if (!s) return "-";
  return s.slice(0, 10);
}

export default function CrewExitsClient({ crewId, initialRows }: { crewId: string; initialRows: Row[] }) {
  const [rows] = useState<Row[]>(initialRows);
  const [tab, setTab] = useState<"all" | "leave" | "kick" | "drop">("all");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    let list = rows;
    if (tab !== "all") list = list.filter((r) => r.exit_type === tab);

    const t = q.trim().toLowerCase();
    if (!t) return list;
    return list.filter((r) => (r.display_name ?? "").toLowerCase().includes(t));
  }, [rows, tab, q]);

  return (
    <div style={{ padding: 0, color: "black" }}>
      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <button style={tabBtn(tab === "all")} onClick={() => setTab("all")}>전체</button>
        <button style={tabBtn(tab === "leave")} onClick={() => setTab("leave")}>퇴장</button>
        <button style={tabBtn(tab === "kick")} onClick={() => setTab("kick")}>추방</button>
        <button style={tabBtn(tab === "drop")} onClick={() => setTab("drop")}>이탈</button>
      </div>

      <div style={{ marginTop: 10 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="닉네임 검색"
          style={{ width: "100%", padding: 10, borderRadius: 12, border: "1px solid #cbd5e1" }}
        />
      </div>

      <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
        {filtered.map((r) => (
          <div key={r.id} style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div style={{ fontWeight: 900 }}>{r.display_name}</div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>{typeLabel(r.exit_type)}</div>
            </div>

            <div style={{ marginTop: 6, fontSize: 13, opacity: 0.85 }}>
              입장 {fmtDate(r.joined_at)} · 퇴장 {fmtDate(r.exited_at)}
            </div>

            {r.reason && (
              <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
                사유: {r.reason}
              </div>
            )}
          </div>
        ))}

        {filtered.length === 0 && <div style={{ fontSize: 13, opacity: 0.7 }}>기록이 없습니다.</div>}
      </div>
    </div>
  );
}

const btn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #cbd5e1",
  background: "white",
  cursor: "pointer",
  fontWeight: 900,
  color: "black",
};

const tabBtn = (active: boolean): React.CSSProperties => ({
  ...btn,
  background: active ? "#DBEAFE" : "white",
  borderColor: active ? "#60A5FA" : "#cbd5e1",
});

const card: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  padding: 12,
  background: "white",
};
