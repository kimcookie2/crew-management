"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type Row = {
  id: string;
  nickname: string;
  status: string;
  created_at: string;
  auth_user_id: string;
  reason: string | null;
};

export default function AdminJoinRequests({ crewId }: { crewId: string }) {
  const sb = supabaseBrowser();
  const [rows, setRows] = useState<Row[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function load() {
    setMsg(null);
    const { data, error } = await sb
      .from("crew_join_requests")
      .select("id,nickname,status,created_at,auth_user_id,reason")
      .eq("crew_id", crewId)
      .order("created_at", { ascending: false });

    if (error) return setMsg(error.message);
    setRows((data ?? []) as Row[]);
  }

  useEffect(() => {
    load();
  }, [crewId]);

  async function approve(id: string) {
    setLoadingId(id);
    setMsg(null);
    const { error } = await sb.rpc("approve_join_request", { p_request_id: id });
    setLoadingId(null);
    if (error) return setMsg(error.message);
    await load();
  }

  async function reject(id: string) {
    const reason = prompt("거절 사유(선택)") ?? "";
    setLoadingId(id);
    setMsg(null);
    const { error } = await sb.rpc("reject_join_request", {
      p_request_id: id,
      p_reason: reason,
    });
    setLoadingId(null);
    if (error) return setMsg(error.message);
    await load();
  }

  const pending = rows.filter((r) => r.status === "pending");

  return (
    <div style={{ color: "black" }}>
      {msg && <div style={{ color: "crimson", marginBottom: 10 }}>{msg}</div>}

      <div style={{ marginBottom: 10, fontSize: 13, opacity: 0.85 }}>
        대기 {pending.length}건 / 전체 {rows.length}건
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {pending.map((r) => (
          <div key={r.id} style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <strong>{r.nickname}</strong>
              <span style={{ fontSize: 12, opacity: 0.7 }}>{new Date(r.created_at).toLocaleString()}</span>
            </div>
            <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
              auth_user_id: {r.auth_user_id}
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button style={btn} disabled={loadingId === r.id} onClick={() => approve(r.id)}>
                승인
              </button>
              <button style={btn} disabled={loadingId === r.id} onClick={() => reject(r.id)}>
                거절
              </button>
            </div>
          </div>
        ))}

        {pending.length === 0 && <div style={{ fontSize: 13, opacity: 0.75 }}>대기 중인 요청이 없습니다.</div>}
      </div>
    </div>
  );
}

const card: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  padding: 12,
  background: "white",
};

const btn: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  background: "white",
  cursor: "pointer",
  fontWeight: 800,
};
