"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";

type Row = {
  membership_id: string;
  display_name: string;
  role: string | null;
  status: string | null;
  joined_at: string | null;
  hidden_date: string | null;
  reason: string | null;
};

const todayYmd = () => new Date().toISOString().slice(0, 10);

function statusLabel(s: string | null) {
  if (s === "inactive") return "임시퇴장";
  if (s === "left") return "탈퇴";
  if (s === "kicked") return "추방";
  if (s === "dropped") return "이탈";
  return s ?? "";
}

export default function CrewHiddenClient({
  crewId,
  initialRows,
}: {
  crewId: string;
  initialRows: Row[];
}) {
  const sb = supabaseBrowser();
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter((r) => (r.display_name ?? "").toLowerCase().includes(t));
  }, [rows, q]);

  async function refresh() {
    const { data, error } = await sb.rpc("get_crew_hidden_members_admin", { p_crew_id: crewId });
    if (error) return alert(error.message);
    setRows((data ?? []) as Row[]);
  }

  async function restore(r: Row) {
    if (!confirm(`${r.display_name} 님을 복귀 처리할까요?`)) return;

    setBusyId(r.membership_id);
    const { error } = await sb.rpc("restore_member_active", {
      p_membership_id: r.membership_id,
      p_reason: "복귀",
      p_effective_date: todayYmd(),
    });
    setBusyId(null);

    if (error) return alert(error.message);
    await refresh();
  }

  return (
    <div style={{ padding: 16, color: "black" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <h2 style={{ margin: 0 }}>숨김 멤버</h2>
      </div>

      <div style={{ marginTop: 12 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="닉네임 검색"
          style={{ width: "100%", padding: 10, borderRadius: 12, border: "1px solid #cbd5e1" }}
        />
      </div>

      <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
        {filtered.map((r) => {
          const canRestore = r.status === "inactive";

          return (
            <div
              key={r.membership_id}
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: 14,
                padding: 12,
                background: "#F8FAFC",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div style={{ fontWeight: 900 }}>
                  {r.role === "admin" ? "★" : ""}
                  {r.display_name}
                </div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>{statusLabel(r.status)}</div>
              </div>

              <div style={{ marginTop: 6, fontSize: 13, opacity: 0.85 }}>
                입장: {r.joined_at ?? "-"} · 숨김일: {r.hidden_date ?? "-"}
              </div>

              {r.reason && (
                <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
                  사유: {r.reason}
                </div>
              )}

              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                {canRestore && (
                  <button
                    style={btnPrimary}
                    disabled={busyId === r.membership_id}
                    onClick={() => restore(r)}
                  >
                    {busyId === r.membership_id ? "처리중..." : "복귀"}
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div style={{ fontSize: 13, opacity: 0.7 }}>숨김 멤버가 없습니다.</div>
        )}
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

const btnPrimary: React.CSSProperties = {
  ...btn,
  background: "#111827",
  color: "white",
  borderColor: "#111827",
};