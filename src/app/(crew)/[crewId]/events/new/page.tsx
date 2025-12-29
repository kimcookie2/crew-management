"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

type MemberRow = {
  id: string;
  display_name: string | null;
  status: string | null;
  role: string | null;
  joined_at?: string | null;
};

export default function NewEventPage() {
  const sb = supabaseBrowser();
  const router = useRouter();
  const params = useParams<{ crewId: string }>();
  const crewId = params?.crewId;

  const [date, setDate] = useState<string>(() => {
    // 로컬 YYYY-MM-DD (toISOString 쓰지 말기)
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  });

  const [members, setMembers] = useState<MemberRow[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [gymName, setGymName] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!crewId) return;

    (async () => {
      setMsg(null);
      const { data, error } = await sb
        .from("crew_memberships")
        .select("id, display_name, status, role, joined_at")
        .eq("crew_id", crewId)
        .neq("status", "exited")
        .order("joined_at", { ascending: true });

      if (error) {
        setMsg(error.message);
        return;
      }

      const rows = (data ?? []) as MemberRow[];
      setMembers(rows);

      // 기본: active만 체크 상태로 시작(원하면 전부 false로 바꿔도 됨)
      const init: Record<string, boolean> = {};
      rows.forEach((r) => {
        init[r.id] = false;
      });
      setSelected(init);
    })();
  }, [crewId]);

  const selectedIds = useMemo(
    () => Object.entries(selected).filter(([, v]) => v).map(([k]) => k),
    [selected]
  );

  function toggleAll(checked: boolean) {
    const next: Record<string, boolean> = {};
    members.forEach((m) => {
      // 정지(hold 등)는 기본 제외하고 싶으면 여기서 조건 걸기
      next[m.id] = checked;
    });
    setSelected(next);
  }

  const filteredMembers = useMemo(() => {
    const keyword = q.trim().toLowerCase();
    if (!keyword) return members;

    return members.filter((m) => {
      const name = (m.display_name ?? "").toLowerCase();
      return name.includes(keyword);
    });
  }, [members, q]);

  async function onSubmit() {
    if (!crewId) return;
    if (!date) return setMsg("날짜를 선택해줘.");
    if (!gymName.trim()) return setMsg("장소를 입력해줘.");
    if (selectedIds.length === 0) return setMsg("참석자를 최소 1명 이상 선택해줘.");

    setLoading(true);
    setMsg(null);

    const { data, error } = await sb.rpc("create_event_and_attendances", {
      p_crew_id: crewId,
      p_event_date: date,
      p_gym_name: gymName.trim(),
      p_membership_ids: selectedIds,
    });

    setLoading(false);

    if (error) {
      setMsg(error.message);
      return;
    }
    
    // 크루 대시보드 페이지로 이동
    router.push(`/${crewId}/dashboard`);
  }

  return (
    <div style={{ padding: 16, maxWidth: 900, margin: "0 auto" }}>
      <h2 style={{ marginBottom: 12 }}>참석 입력</h2>

      <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
        장소
        <input
          value={gymName}
          onChange={(e) => setGymName(e.target.value)}
          placeholder="예: 더클라임 연남"
          style={{ padding: 8, border: "1px solid #cbd5e1", borderRadius: 10 }}
        />
      </label>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          날짜
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{ padding: 8, border: "1px solid #cbd5e1", borderRadius: 10 }}
            color="white"
          />
        </label>

        <button
          type="button"
          onClick={() => toggleAll(true)}
          style={btn}
        >
          전체 선택
        </button>
        <button
          type="button"
          onClick={() => toggleAll(false)}
          style={btn}
        >
          전체 해제
        </button>

        <div style={{ fontSize: 13, opacity: 0.8 }}>
          선택: {selectedIds.length}명
        </div>
      </div>

      <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
        이름 검색
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="닉네임 입력"
          style={{ padding: 8, border: "1px solid #cbd5e1", borderRadius: 10 }}
        />
      </label>

      {msg && <div style={{ marginTop: 12, color: "crimson" }}>{msg}</div>}

      <div style={{ marginTop: 14, border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: 10, background: "#f1f5f9", fontSize: 13 }}>
          멤버 목록 (체크하면 해당 날짜 참석 처리)
        </div>

        <div style={{ maxHeight: 520, overflow: "auto" }}>
          {filteredMembers.map((m) => {
            const isHold = (m.status ?? "active") !== "active";
            const label = `${m.role === "admin" ? "★" : ""}${m.display_name ?? "(이름없음)"}`;
            return (
              <label
                key={m.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 12px",
                  borderTop: "1px solid #e2e8f0",
                  background: isHold ? "#e5e7eb" : "white",
                }}
              >
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={!!selected[m.id]}
                    onChange={(e) =>
                      setSelected((prev) => ({ ...prev, [m.id]: e.target.checked }))
                    }
                  />
                  <strong style={{ color: "black" }}>{label}</strong>
                  {isHold && <span style={{ fontSize: 12, opacity: 0.8 }}>정지</span>}
                </div>

                <span style={{ fontSize: 12, opacity: 0.8 }}>
                  {m.joined_at ? `입장: ${m.joined_at}` : ""}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
        <button
          onClick={onSubmit}
          disabled={loading}
          style={{ ...btn, padding: "10px 14px", fontWeight: 700 }}
        >
          {loading ? "저장 중..." : "선택 멤버 참석 저장"}
        </button>
        <button
          onClick={() => router.push(`/${crewId}/events`)}
          style={btn}
        >
          목록으로
        </button>
      </div>
    </div>
  );
}

const btn: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  background: "white",
  cursor: "pointer",
  color: "black"
};
